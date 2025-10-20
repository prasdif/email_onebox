const { query } = require('./dist/config/database');

async function addTestData() {
  const emails = [
    ['msg-1', 'test-account', 'recruiter@techcorp.com', 'you@example.com', 'Job Opportunity - Senior Developer', 'Hi, We have a great opportunity for a Senior Developer position. Are you interested?', new Date(Date.now() - 86400000), 'INBOX', 'Interested', 1001],
    ['msg-2', 'test-account', 'hr@startup.io', 'you@example.com', 'Interview Scheduled', 'Your technical interview is scheduled for tomorrow at 2 PM.', new Date(Date.now() - 7200000), 'INBOX', 'Meeting Booked', 1002],
    ['msg-3', 'test-account', 'spam@offers.net', 'you@example.com', 'CLICK HERE NOW', 'Buy now and get 50% off!', new Date(Date.now() - 259200000), 'INBOX', 'Spam', 1003],
    ['msg-4', 'test-account', 'john@company.com', 'you@example.com', 'Out of Office', 'I am out of office until Monday.', new Date(Date.now() - 432000000), 'INBOX', 'Out of Office', 1004],
    ['msg-5', 'test-account', 'newsletter@tech.com', 'you@example.com', 'Weekly Newsletter', 'Unsubscribe here.', new Date(Date.now() - 604800000), 'INBOX', 'Not Interested', 1005]
  ];

  for (const email of emails) {
    await query(
      'INSERT INTO emails (message_id, account_id, from_address, to_address, subject, body, received_at, folder, category, uid) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      email
    );
  }
  
  console.log('✅ Test data added!');
  process.exit(0);
}

addTestData().catch(console.error);