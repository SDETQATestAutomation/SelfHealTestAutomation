const User = require('./models/User');

(async function seed() {
  try {
    await User.create('prashant.ranjan@gmail.com', 'password123');
    console.log('User inserted successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error inserting user:', err);
    process.exit(1);
  }
})();