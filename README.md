# email_ai_automation

### Prerequisites

Node.js: Ensure you have Node.js installed.

Redis: Make sure Redis is installed and running for BullMQ to function.

Environment Variables: Create a .env file in the root directory and populate it with the following variables:

```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URL=your-google-redirect-url
OUTLOOK_CLIENT_ID=your-outlook-client-id
OUTLOOK_CLIENT_SECRET=your-outlook-client-secret
OUTLOOK_REDIRECT_URL=your-outlook-redirect-url
OUTLOOK_ACCESS_TOKEN=your-outlook-access-token
OPENAI_API_KEY=your-openai-api-key
REDIS_HOST=your-redis-host
REDIS_PORT=your-redis-port
REDIS_PASSWORD=your-redis-password
```

### Installation 

Step 1: Clone the repo

```
git clone https:/github.com/narasimhauppala/email_ai_automation.git
cd email_ai_automation
```

Step 2: Install dependencies:

```
npm install
```

Step 3: Start the server:

```
ts-node server.ts
```

Now the server will run on ```PORT 3000```


### Routes

Route: ```/auth/google```

Description: Initiates the Google OAuth2 flow.

Method: GET


Route: ```/auth/outlook```

Description: Initiates the Outlook OAuth2 flow.

Method: GET


Route: ```/admin/queues```

Description: Provides a web interface to monitor and manage BullMQ jobs.

Method: GET



### Functionality

`Fetching Emails:`

Gmail: Uses Google API to fetch unread emails.
Outlook: Uses Microsoft Graph API to fetch unread emails.
Analyzing Email Content:

`Function: analyzeEmailContent`
Description: Uses OpenAI API to analyze email content and classify it into categories: Interested, Not Interested, More Information.
Generating Replies:

`Function: generateReply`
Description: Uses OpenAI API to generate appropriate replies based on the email content analysis.
Sending Replies:

Gmail: Uses Google API to send replies.
Outlook: Uses Microsoft Graph API to send replies.


Processing Emails:
`BullMQ Worker:`
Processes email jobs added to the queue, analyzes content, generates replies, and sends responses.
Periodic Email Check:

`Cron Job:`
Runs every 5 minutes to fetch new emails from Gmail and Outlook, then adds them to the queue for processing.



