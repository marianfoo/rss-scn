import fs from 'fs';

(async () => {
  try {
    // Replace this with your own profile ID
    // You can find your profile ID by navigating to your profile page and looking at the URL
    // e.g. https://profile.sap.com/profile/ide74053729274e7e2ae557b9a21e023fbf6239bb72f86c971922f90bdca9bebc1
    // or go to https://community.sap.com/t5/user/viewprofilepage/user-id/61 and replace 61 with your user ID
    const yourProfileId = 'ide74053729274e7e2ae557b9a21e023fbf6239bb72f86c971922f90bdca9bebc1';

    // Step 1: Fetch all followers
    const followersResponse = await fetch(`https://api.profile.sap.com/profile/api/v1/profiles/following/${yourProfileId}?size=200&page=0`, {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'Referer': 'https://profile.sap.com/',
      },
      method: 'GET'
    });

    const followersData = await followersResponse.json();
    const followers = followersData.content;

    let opmlFeeds = [];

    // Step 2: Iterate over each follower
    for (const follower of followers) {
      const { profileId, firstName, lastName } = follower;

      // Step 2.1: Fetch the follower's profile page to get UID
      const profileUrl = `https://profile.sap.com/profile/${profileId}`;
      const profileResponse = await fetch(profileUrl, {
        headers: {
          'accept': 'text/html',
          'Referer': 'https://profile.sap.com/',
        },
        method: 'GET'
      });

      const profileHtml = await profileResponse.text();

      // Step 2.2: Extract the UID from the "__NEXT_DATA__" script tag
      const uidMatch = profileHtml.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
      if (!uidMatch) {
        console.log(`Cannot extract UID from profile page of ${firstName} ${lastName} (${profileId})`);
        continue;
      }

      let uid;
      try {
        const nextDataJson = JSON.parse(uidMatch[1]);
        uid = nextDataJson.props.pageProps.user.uid;
      } catch (e) {
        console.log(`Error parsing UID from profile page of ${firstName} ${lastName} (${profileId})`);
        continue;
      }

      // Step 3: Fetch content for each follower using UID
      const contentResponse = await fetch(`https://searchproxy.api.community.sap.com/api/v1/search?limit=3&orderBy=CREATE_TIME&order=DESC&authorId=${uid}`, {
        headers: {
          'accept': 'application/json, text/plain, */*',
          'Referer': 'https://profile.sap.com/',
        },
        method: 'GET'
      });

      const contentData = await contentResponse.json();

      // Check if there is content
      if (contentData.totalCount === 0 || !contentData.contentItems || contentData.contentItems.length === 0) {
        console.log(`No content found for ${firstName} ${lastName} (${profileId})`);
        continue;
      }

      // Step 4: For each content item, extract content ID from the content URL
      const contentItem = contentData.contentItems[0]; // Taking the first content item
      const contentUrl = contentItem.url;

      // Extract the content ID from the URL
      const contentIdMatch = contentUrl.match(/(?:ba-p|td-p|qaq-p|ev-p)\/(\d+)/);
      if (!contentIdMatch) {
        // Try alternative extraction: get the last segment after final slash
        const lastSegmentMatch = contentUrl.split('/').pop();
        if (lastSegmentMatch && /^\d+$/.test(lastSegmentMatch)) {
          const contentId = lastSegmentMatch;
        } else {
          console.log(`Cannot extract content ID from URL: ${contentUrl}`);
          continue;
        }
      }
      const contentId = contentIdMatch ? contentIdMatch[1] : lastSegmentMatch;

      // Step 5: Query the SAP SCN API to get the author.id
      const authorResponse = await fetch(`https://community.sap.com/api/2.0/search?q=select%20author.id%20from%20messages%20where%20id%20=%20'${contentId}'`, {
        headers: {
          'accept': 'application/json, text/plain, */*',
        },
        method: 'GET'
      });

      const authorData = await authorResponse.json();

      if (authorData.status !== 'success' || !authorData.data.items || authorData.data.items.length === 0) {
        console.log(`Cannot find author ID for content ID: ${contentId}`);
        continue;
      }

      const authorId = authorData.data.items[0].author.id;

      // Step 6: Build the RSS feed URL
      const rssFeedUrl = `https://rss-scn.marianzeis.de/api/messages?author.id=${authorId}`;

      // Step 7: Add to OPML feeds array
      opmlFeeds.push({
        title: `${firstName} ${lastName}`,
        xmlUrl: rssFeedUrl,
        htmlUrl: contentUrl,
      });
    }

    // Step 8: Generate the OPML file
    const opmlContent = generateOPML(opmlFeeds);
    fs.writeFileSync('followers_feeds.opml', opmlContent);
    console.log('OPML file has been generated: followers_feeds.opml');

  } catch (error) {
    console.error('An error occurred:', error);
  }
})();

// Function to generate OPML content
function generateOPML(feeds) {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Followers RSS Feeds</title>
  </head>
  <body>
    <outline text="Followers Feeds">`;

  const footer = `
    </outline>
  </body>
</opml>`;

  const outlines = feeds.map(feed => `
      <outline type="rss" text="${feed.title}" title="${feed.title}" xmlUrl="${feed.xmlUrl}" htmlUrl="${feed.htmlUrl}" />`).join('');

  return header + outlines + footer;
}
