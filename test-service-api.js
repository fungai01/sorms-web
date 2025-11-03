// Test script to call backend API directly
const API_URL = 'http://103.81.87.99:5656/api';

async function testCreateService() {
  const serviceData = {
    code: 'TEST001',
    name: 'Test Service',
    description: 'Test description',
    unitPrice: 100000,
    unitName: 'lần',
    isActive: true
  };

  console.log('📤 Sending request to:', `${API_URL}/services`);
  console.log('📦 Request body:', JSON.stringify(serviceData, null, 2));

  try {
    const response = await fetch(`${API_URL}/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serviceData)
    });

    console.log('📥 Response status:', response.status);
    console.log('📥 Response ok:', response.ok);

    const data = await response.json();
    console.log('📥 Response data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('❌ Request failed!');
    } else {
      console.log('✅ Request successful!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCreateService();

