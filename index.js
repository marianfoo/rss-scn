import express from 'express';
import RSS from 'rss';

const app = express();

const BASE_API_URL = 'https://community.sap.com/api/2.0/search';

app.get('/api/messages', async (req, res) => {
  try {
    let q =
      'select id, subject, view_href, search_snippet, body, post_time, author.login, author.view_href, metrics.views from messages';

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
      language: 'en',
      pubDate: new Date().toUTCString(),
      custom_namespaces: {
        content: 'http://purl.org/rss/1.0/modules/content/',
        dc: 'http://purl.org/dc/elements/1.1/',
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        taxo: 'http://purl.org/rss/1.0/modules/taxonomy/',
      },
      custom_elements: [{ 'dc:date': new Date().toISOString() }],
    });

    // Loop over the items and add them to the feed
    data.data.items.forEach((item) => {
      feed.item({
        title: item.subject,
        description: item.search_snippet || item.body,
        url: 'https://community.sap.com' + item.view_href,
        link: 'https://community.sap.com' + item.view_href,
        date: new Date(item.post_time),
        guid: 'https://community.sap.com' + item.view_href,
        custom_elements: [
          { 'dc:creator': item.author.login },
          { 'dc:date': new Date(item.post_time).toISOString() },
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
