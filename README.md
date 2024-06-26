# email_ai_automation

###Prerequisites

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
git clone https://github.com/your-repo//email_ai_automation.git
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


