import express from 'express';
import RSS from 'rss';
import fs from 'fs/promises';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

const app = express();

// Serve static files from the public directory
// This will serve index.html from the public directory when accessing the root URL
app.use(express.static('public'));

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SAP Community RSS Feed API',
      version: '1.0.0',
      description: 'API to generate RSS feeds from SAP Community content',
    },
    servers: [
      {
        url: 'https://rss-scn.marianzeis.de',
        description: 'Production server'
      },
      {
        url: 'http://localhost:3100',
        description: 'Development server'
      }
    ],
  },
  apis: ['./index.js'], // files containing annotations
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

const BASE_API_URL = 'https://community.sap.com/api/2.0/search';

// Load products.json on startup
let products = [];
try {
  const productsData = await fs.readFile('products.json', 'utf8');
  products = JSON.parse(productsData);
} catch (error) {
  console.error('Error loading products.json:', error);
  process.exit(1);
}

/**
 * @swagger
 * /api/messages:
 *   get:
 *     summary: Get SAP Community messages as RSS feed
 *     description: Retrieves messages from SAP Community and returns them in RSS format
 *     parameters:
 *       - in: query
 *         name: author.id
 *         schema:
 *           type: string
 *         description: Filter by author ID
 *       - in: query
 *         name: board.id
 *         schema:
 *           type: string
 *         description: Filter by board ID
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *         description: Filter by subject (partial match)
 *       - in: query
 *         name: conversation.style
 *         schema:
 *           type: string
 *           enum: [blog, qanda]
 *         description: Filter by conversation style
 *       - in: query
 *         name: managedTag.id
 *         schema:
 *           type: string
 *         description: Filter by SAP Managed Tag ID. Browse available tags at https://community.sap.com/t5/all-sap-managed-tags/ct-p/managed-tags. This is the preferred method over managedTag.title as IDs are guaranteed to be unique.
 *       - in: query
 *         name: managedTag.title
 *         schema:
 *           type: string
 *         description: Filter by SAP Managed Tag title (not recommended as titles may not be unique). Browse available tags at https://community.sap.com/t5/all-sap-managed-tags/ct-p/managed-tags
 *       - in: query
 *         name: feeds.replies
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Include all posts including replies (true) or show initial posts only (false)
 *     responses:
 *       200:
 *         description: RSS feed of messages
 *         content:
 *           application/rss+xml:
 *             schema:
 *               type: string
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Server error
 */
app.get('/api/messages', async (req, res) => {
  try {
    const allowedFilters = [
      'author.id',
      'board.id',
      'id',
      'subject',
      'conversation.style',
      'post_time_from',
      'post_time_to',
      'min_views',
      'managedTag.id',
      'managedTag.title',
      'feeds.replies'
    ];
    
    const hasFilter = allowedFilters.some(filter => req.query[filter]);
    if (!hasFilter) {
      res.status(400).send('At least one filter parameter is required');
      return;
    }

    let q = 'select id, subject, view_href, search_snippet, body, post_time, author.login, author.view_href, metrics.views from messages';

    // Build the WHERE clause based on query parameters
    const whereClauses = [];

    // Filtering by author.id
    if (req.query['author.id']) {
      const authorId = req.query['author.id'].replace(/'/g, "\\'");
      whereClauses.push(`author.id = '${authorId}'`);
    }

    // Filtering by other properties (add as needed)
    if (req.query['board.id']) {
      const boardId = req.query['board.id'].replace(/'/g, "\\'");
      whereClauses.push(`board.id = '${boardId}'`);
    }

    // Filtering by message id
    if (req.query.id) {
      const messageId = req.query.id.replace(/'/g, "\\'");
      whereClauses.push(`id = '${messageId}'`);
    }

    // Filtering by subject (partial match)
    if (req.query.subject) {
      const subject = req.query.subject.replace(/'/g, "\\'");
      whereClauses.push(`subject LIKE '%${subject}%'`);
    }

    // Filtering by conversation style
    if (req.query['conversation.style']) {
      const style = req.query['conversation.style'].replace(/'/g, "\\'");
      whereClauses.push(`conversation.style = '${style}'`);
    }

    // Filtering by post time range
    if (req.query.post_time_from) {
      const fromDate = req.query.post_time_from.replace(/'/g, "\\'");
      whereClauses.push(`post_time >= '${fromDate}'`);
    }
    if (req.query.post_time_to) {
      const toDate = req.query.post_time_to.replace(/'/g, "\\'");
      whereClauses.push(`post_time <= '${toDate}'`);
    }

    // Filtering by minimum view count
    if (req.query.min_views) {
      const minViews = parseInt(req.query.min_views, 10);
      if (!isNaN(minViews)) {
        whereClauses.push(`metrics.views >= ${minViews}`);
      }
    }

    // Filtering by conversation style (required when using SAP Managed Tag filter)
    if (req.query['managedTag.id'] || req.query['managedTag.title']) {
      if (!req.query['conversation.style'] || 
          (req.query['conversation.style'] !== 'blog' && req.query['conversation.style'] !== 'qanda')) {
        res.status(400).send('When filtering by SAP Managed Tags, conversation.style must be either "blog" or "qanda"');
        return;
      }
      const style = req.query['conversation.style'].replace(/'/g, "\\'");
      whereClauses.push(`conversation.style = '${style}'`);
    }

    // Filtering by SAP Managed Tags
    if (req.query['managedTag.id']) {
      const productId = req.query['managedTag.id'].replace(/'/g, "\\'");
      whereClauses.push(`products.id = '${productId}'`);
    } else if (req.query['managedTag.title']) {
      const productTitle = decodeURIComponent(req.query['managedTag.title']);
      const product = products.find(p => p.title === productTitle);
      if (!product) {
        res.status(400).send('SAP Managed Tag title not found');
        return;
      }
      whereClauses.push(`products.id = '${product.id}'`);
    }

    // Filtering by replies (depth=0 for initial posts only)
    if (req.query['feeds.replies'] === 'false') {
      whereClauses.push('depth = 0');
    }

    if (whereClauses.length > 0) {
      q += ' WHERE ' + whereClauses.join(' AND ');
    }

    // Always order by id DESC, regardless of order_by parameter
    q += ' ORDER BY id DESC';

    // Always add a fixed LIMIT of 25
    q += ' LIMIT 25';

    const queryParams = new URLSearchParams();
    queryParams.append('q', q);

    const apiUrl = `${BASE_API_URL}?${queryParams.toString()}`;

    // Fetch data from the SAP Community API
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status !== 'success') {
      res.status(500).send('Error fetching data from SAP Community API');
      return;
    }

    // Create RSS feed with additional namespaces and elements
    const feed = new RSS({
      title: 'SAP Community Messages RSS Feed',
      description: 'Latest messages from the SAP Community',
      feed_url: req.protocol + '://' + req.get('host') + req.originalUrl,
      site_url: 'https://community.sap.com',
      language: 'en-US',
      custom_namespaces: {
        content: 'http://purl.org/rss/1.0/modules/content/',
        dc: 'http://purl.org/dc/elements/1.1/',
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        taxo: 'http://purl.org/rss/1.0/modules/taxonomy/',
      },
      custom_elements: [
        { 'docs': 'https://www.rssboard.org/rss-specification' },
        { 'ttl': '60' },
        { 'webMaster': 'marian@marianzeis.de (Administrator)' },
      ],
      image_url: 'https://community.sap.com/html/@75A0878F21D09461247886DEA5121E3C/assets/favicon.ico',
    });

    // Find the most recent item date to use as feed pubDate
    let mostRecentDate = new Date(0); // Initialize with epoch time
    if (data.data.items.length > 0) {
      data.data.items.forEach(item => {
        const itemDate = new Date(item.post_time);
        if (itemDate > mostRecentDate) {
          mostRecentDate = itemDate;
        }
      });
      feed.pubDate = mostRecentDate.toUTCString();
      feed.custom_elements.unshift({ 'dc:date': mostRecentDate.toISOString() });
    } else {
      // If no items, use current date
      feed.pubDate = new Date().toUTCString();
      feed.custom_elements.unshift({ 'dc:date': new Date().toISOString() });
    }

    // Loop over the items and add them to the feed
    data.data.items.forEach((item) => {
      feed.item({
        title: item.subject,
        description: item.search_snippet || item.body,
        url: item.view_href,
        link: item.view_href,
        date: new Date(item.post_time),
        guid: item.id,
        custom_elements: [
          { 'dc:creator': item.author.login },
          { 'dc:date': new Date(item.post_time).toISOString() },
          { 'content:encoded': { _cdata: item.body || item.search_snippet } },
        ],
      });
    });

    // Set the response content type to application/rss+xml
    res.set('Content-Type', 'application/rss+xml');
    res.send(feed.xml({ indent: true }));
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3100;

app.listen(PORT, () => {
  console.log(`RSS feed server is running on port ${PORT}`);
});
