import express, { Request, Response } from 'express';
import { google, gmail_v1 } from 'googleapis';
import { Client } from '@microsoft/microsoft-graph-client';
import { Queue, Worker } from 'bullmq';
import { Configuration, OpenAIApi } from 'openai';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import axios from 'axios';
import querystring from 'querystring';



dotenv.config();

const app = express();
const port = 3000;

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

app.use('/admin/queues', serverAdapter.getRouter());

// Google OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URL
);

// Microsoft OAuth2 client setup
const msalClient = Client.init({
    authProvider: (done) => done(null, process.env.OUTLOOK_CLIENT_SECRET!)
});

// BullMQ queue setup
const emailQueue = new Queue('emailQueue', {
    connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT!, 10),
        password: process.env.REDIS_PASSWORD
    }
});

createBullBoard({
    queues: [new BullAdapter(emailQueue)],
    serverAdapter: serverAdapter
});

// Setup routes for OAuth
app.get('/auth/google', (req: Request, res: Response) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.readonly']
    });
    res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req: Request, res: Response) => {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);
    res.send('Google OAuth successful');
});

app.get('/auth/outlook', (req, res) => {
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${process.env.OUTLOOK_CLIENT_ID}&response_type=code&redirect_uri=${process.env.OUTLOOK_REDIRECT_URL}&response_mode=query&scope=Mail.ReadWrite Mail.Send`;
    res.redirect(authUrl);
});

app.get('/auth/outlook/callback', async (req, res) => {
    const { code } = req.query;

    try {
        const tokenResponse = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', querystring.stringify({
            grant_type: 'authorization_code',
            code: code as string,
            redirect_uri: process.env.OUTLOOK_REDIRECT_URL,
            client_id: process.env.OUTLOOK_CLIENT_ID,
            client_secret: process.env.OUTLOOK_CLIENT_SECRET
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { data } = tokenResponse;

        // Store data securely
        console.log('Token response:', data);
        res.send('Outlook account connected successfully');
    } catch (error) {
        console.error('Error exchanging authorization code for token:', error);
        res.status(500).send('Failed to connect Outlook account');
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log('For the UI, open http://localhost:3000/admin/queues');
});

// OpenAI client setup
const openai = new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY
}));

// Function to fetch emails from Gmail
const fetchGmailEmails = async (auth: any) => {
    const gmail = google.gmail({ version: 'v1', auth });
    const response = await gmail.users.messages.list({ userId: 'me', q: 'is:unread' });
    const emails: gmail_v1.Schema$Message[] = [];
    for (const message of response.data.messages || []) {
        const email = await gmail.users.messages.get({ userId: 'me', id: message.id! });
        emails.push(email.data);
    }
    return emails;
};

// Function to fetch emails from Outlook
const fetchOutlookEmails = async (auth: any) => {
    const client = Client.init({ authProvider: (done) => done(null, auth) });
    const messages = await client.api('/me/mailFolders/inbox/messages').filter('isRead eq false').get();
    return messages.value;
};

// Function to analyze email content using OpenAI
const analyzeEmailContent = async (content: string) => {
    const response = await openai.createCompletion({
        model: 'gpt-3.5-turbo',
        prompt: `Analyze the following email content and classify it into: Interested, Not Interested, More Information:\n\n${content}`,
        max_tokens: 60,
    });
    console.log(response,"RESS")
    // Check if response.data.choices is defined and has at least one element
    if (response.data.choices && response.data.choices.length > 0) {
        // Further check if response.data.choices[0].text is defined
        
        if (response.data.choices[0].text) {
            return response.data.choices[0].text.trim();
        } else {
            console.error('Text is undefined in response data');
            return ''; 
        }
    } else {
        console.error('No choices found in response data');
        return '';
    }
};

// Function to generate reply using OpenAI
const generateReply = async (context: string) => {
    const response = await openai.createCompletion({
        model: 'gpt-3.5-turbo',
        prompt: `Generate an appropriate reply based on the context: ${context}`,
        max_tokens: 100,
    });
    // Check if response.data.choices is defined and has at least one element of data
    if (response.data.choices && response.data.choices.length > 0) {
        // Further check if response.data.choices[0].text is defined
        if (response.data.choices[0].text) {
            return response.data.choices[0].text.trim();
        } else {
            console.error('Text is undefined in response data');
            return '';
        }
    } else {
        console.error('No choices found in response data');
        return ''; 
    }
};

// Function to send reply via Gmail
const sendGmailReply = async (auth: any, email: gmail_v1.Schema$Message, reply: string) => {
    const gmail = google.gmail({ version: 'v1', auth });
    const rawMessage = [
        `From: "Me" <me@example.com>`,
        `To: ${email.payload?.headers?.find(header => header.name === 'From')?.value}`,
        `Subject: Re: ${email.payload?.headers?.find(header => header.name === 'Subject')?.value}`,
        '',
        reply
    ].join('\n');

    await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
            raw: Buffer.from(rawMessage).toString('base64'),
        }
    });
};

// Function to send reply via Outlook
const sendOutlookReply = async (auth: any, email: any, reply: string) => {
    const client = Client.init({ authProvider: (done) => done(null, auth) });
    await client.api('/me/sendMail').post({
        message: {
            subject: 'Re: ' + email.subject,
            body: { contentType: 'Text', content: reply },
            toRecipients: [{ emailAddress: { address: email.sender } }]
        },
        saveToSentItems: 'true'
    });
};

// BullMQ worker to process email jobs
const worker = new Worker('emailQueue', async job => {
    const { accessToken, emailService, email } = job.data;

    const emailContent = email.snippet || email.bodyPreview;
    const label = await analyzeEmailContent(emailContent);
    let reply = '';

    if (label === 'Interested') {
        reply = await generateReply('Thank you for your interest. Are you available for a demo call?');
    } else if (label === 'Not Interested') {
        reply = await generateReply('Thank you for your response. Let us know if you change your mind.');
    } else if (label === 'More Information') {
        reply = await generateReply('Can you provide more details about your request?');
    }

    if (emailService === 'gmail') {
        await sendGmailReply(accessToken, email, reply);
    } else if (emailService === 'outlook') {
        await sendOutlookReply(accessToken, email, reply);
    }
}, {
    connection: {
        host: process.env.REDIS_HOST!,
        port: parseInt(process.env.REDIS_PORT!, 10),
        password: process.env.REDIS_PASSWORD
    }
});

// Periodically check for new emails and add jobs to the queue (every 5 mints)
cron.schedule('*/5 * * * *', async () => {
    console.log('Checking for new emails...');

    // Fetch and queue Gmail emails
    const gmailEmails = await fetchGmailEmails(oauth2Client);
    for (const email of gmailEmails) {
        await emailQueue.add('processEmail', {
            accessToken: oauth2Client.credentials.access_token,
            emailService: 'gmail',
            email: email
        });
    }

    // Fetch and queue Outlook emails
    const outlookEmails = await fetchOutlookEmails(msalClient);
    for (const email of outlookEmails) {
        await emailQueue.add('processEmail', {
            accessToken: process.env.OUTLOOK_ACCESS_TOKEN,
            emailService: 'outlook',
            email: email
        });
    }
});
