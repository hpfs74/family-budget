export function Transactions() {
  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 1rem',
    textAlign: 'center' as const
  };

  return (
    <div style={containerStyle}>
      <h1>Bank Transactions</h1>
      <div style={{
        backgroundColor: '#f9fafb',
        padding: '2rem',
        borderRadius: '0.5rem',
        marginTop: '2rem'
      }}>
        <h2>Coming Soon!</h2>
        <p style={{ color: '#6b7280', marginTop: '1rem' }}>
          The transactions CRUD interface will be implemented here.
          It will allow you to:
        </p>
        <ul style={{
          textAlign: 'left',
          maxWidth: '400px',
          margin: '1rem auto',
          color: '#6b7280'
        }}>
          <li>Create new transactions</li>
          <li>View transaction history</li>
          <li>Update transaction details</li>
          <li>Delete transactions</li>
          <li>Filter by account, category, or date</li>
        </ul>
      </div>
    </div>
  );
}