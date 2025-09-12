import { useState, useEffect } from 'react';

export function App() {
  const [dateTime, setDateTime] = useState<string>('Loading...');

  const fetchDateTime = async () => {
    try {
      setDateTime('Loading...');
      // Note: Replace this URL with your actual API Gateway endpoint after deployment
      const apiEndpoint = process.env.REACT_APP_API_ENDPOINT || 'https://your-api-gateway-url.com/prod/datetime';
      
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setDateTime(data.formatted || data.dateTime || 'No date received');
    } catch (error) {
      console.error('Error fetching date/time:', error);
      setDateTime('Error fetching date/time from API');
    }
  };

  useEffect(() => {
    fetchDateTime();
  }, []);

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Hello World</h1>
      <div style={{ marginTop: '20px' }}>
        <h2>Current Date and Time:</h2>
        <p style={{ fontSize: '18px', fontWeight: 'bold' }}>{dateTime}</p>
        <button onClick={fetchDateTime} style={{ marginTop: '10px', padding: '10px 20px' }}>
          Refresh Date/Time
        </button>
      </div>
    </div>
  );
}

export default App;
