import { useState, useEffect } from 'react';

export function DateTime() {
  const [dateTime, setDateTime] = useState<string>('Loading...');
  const [apiEndpointUrl, setApiEndpointUrl] = useState<string>('');

  const fetchDateTime = async () => {
    const apiEndpoint = import.meta.env.VITE_API_ENDPOINT || 'https://your-api-gateway-url.com/prod/';
    setApiEndpointUrl(apiEndpoint);
    console.log('Using API endpoint:', apiEndpoint);
    try {
      setDateTime('Loading...');
      const response = await fetch(`${apiEndpoint}datetime`);
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

  const containerStyle = {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '0 1rem',
    textAlign: 'center' as const
  };

  const buttonStyle = {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '1rem',
    marginTop: '1rem'
  };

  return (
    <div style={containerStyle}>
      <h1>Date & Time Service</h1>
      <div style={{ marginTop: '2rem' }}>
        <h2>Current Date and Time:</h2>
        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '1rem 0' }}>{dateTime}</p>
        <button onClick={fetchDateTime} style={buttonStyle}>
          Refresh Date/Time
        </button>
        <div style={{ marginTop: '2rem' }}>
          <h3>API Endpoint URL:</h3>
          <code style={{
            backgroundColor: '#f3f4f6',
            padding: '0.5rem',
            borderRadius: '0.375rem',
            display: 'inline-block',
            marginTop: '0.5rem'
          }}>
            {apiEndpointUrl}
          </code>
        </div>
      </div>
    </div>
  );
}