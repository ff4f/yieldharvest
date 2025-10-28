const jwt = require('jsonwebtoken');

// Generate a test JWT token
const payload = {
  userId: 'test-user-123',
  accountId: '0.0.123456',
  role: 'SUPPLIER',
  email: 'test@example.com'
};

const secret = 'your-super-secret-jwt-key-for-yieldharvest-demo';
const token = jwt.sign(payload, secret, { 
  expiresIn: '24h',
  issuer: 'yieldharvest',
  audience: 'yieldharvest-users'
});

console.log('Bearer ' + token);