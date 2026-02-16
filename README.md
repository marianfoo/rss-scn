# SAP Community RSS Feed API

A Node.js server that converts SAP Community content into RSS feeds, allowing you to stay updated with SAP Community posts through your favorite RSS reader.

## Features

- Convert SAP Community messages into RSS feeds
- Filter content by various parameters:
  - Author ID
  - Board ID
  - Subject
  - Conversation style (blog/Q&A)
  - SAP Managed Tags
  - Include/exclude replies
- Swagger documentation available at `/api-docs`
- Automatic deployment via GitHub Actions

## API Usage

### Base URL
- Production: `https://rss-scn.marianzeis.de/`
- Development: `http://localhost:3100`

### Endpoints

#### GET /api/messages

Returns an RSS feed of SAP Community messages based on the provided filters.

**Required**: At least one filter parameter must be specified.

**Parameters:**
- `author.id` - Filter by author ID
- `board.id` - Filter by board ID
- `subject` - Filter by subject (partial match)
- `conversation.style` - Filter by type (`blog` or `qanda`)
- `managedTag.id` - Filter by SAP Managed Tag ID
- `managedTag.title` - Filter by SAP Managed Tag title
- `min_kudos` - Filter by minimum kudos (likes) count
- `feeds.replies` - Include replies (`true`/`false`)

**Example:**
```
https://rss-scn.marianzeis.de/api/messages?conversation.style=blog&managedTag.title=ABAP
```

## Development

### Prerequisites
- Node.js
- npm

### Installation

1. Clone the repository

```bash
git clone https://github.com/marianfoo/rss-scn.git
cd rss-scn
```

2. Install dependencies

```bash
npm install
```

3. Start the server

```bash
node index.js
```

The server will start on port 3100 by default (configurable via PORT environment variable).

## Deployment

The project uses GitHub Actions for automated deployment. The workflow is triggered when:
- Changes are pushed to `index.js` in the main branch
- Manually triggered through GitHub Actions

### Deployment Requirements

The following secrets need to be configured in GitHub:
- `SSH_IP` - Server IP address
- `SSH_USER` - SSH username
- `SSH_PRIVATE_KEY` - SSH private key for authentication

## Documentation

API documentation is available through Swagger UI at [`/api-docs`](https://rss-scn.marianzeis.de/api-docs).

## Scripts

### Create OPML from SAP Community Following

This script generates an OPML file containing RSS feeds for all the people you follow on SAP Community.

#### Prerequisites
- Node.js
- Your SAP Community Profile ID

#### Usage

1. Clone the repository and install dependencies as described above
2. Edit `create-opml-scn-following.js` and replace `yourProfileId` with your SAP Community Profile ID
3. Run the script:

```bash
node create-opml-scn-following.js
```

The script will:
1. Fetch all users you follow on SAP Community
2. Generate RSS feed URLs for each follower
3. Create an OPML file (`followers_feeds.opml`) that you can import into your RSS reader

#### Finding Your Profile ID
You can find your profile ID in one of two ways:
- Navigate to your profile page and copy the ID from the URL:  
  `https://profile.sap.com/profile/[your-profile-id]`
- Go to `https://community.sap.com/t5/user/viewprofilepage/user-id/[your-user-id]`
