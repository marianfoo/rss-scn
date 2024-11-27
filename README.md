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
