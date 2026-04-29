import { testConnection } from './src/features/connection';

const config = {
  host: '172.18.60.180',
  port: 9005,
  cardNumber: '13061913001',
  timeoutMs: 5000,
};

async function runTest() {
  console.log('Testing connection using heartbeat...');
  const result = await testConnection(config.host, config.port, config.cardNumber, config.timeoutMs);
  if (result.success) {
    console.log('✅ Connection successful!');
  } else {
    console.error('❌ Connection failed:', result.errorMessage);
  }
}

runTest().catch(console.error);