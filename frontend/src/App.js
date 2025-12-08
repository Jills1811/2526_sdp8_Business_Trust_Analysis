import React, { useEffect, useState } from 'react';

function App() {
  const [businesses, setBusinesses] = useState([]);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/businesses/')
      .then(res => res.json())
      .then(data => setBusinesses(data))
      .catch(err => console.log(err));
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Business Trust Platform</h1>
      {businesses.length === 0 ? (
        <p>No businesses found. Add some in the backend!</p>
      ) : (
        <ul>
          {businesses.map(b => (
            <li key={b.id}>
              <strong>{b.name}</strong> - Rating: {b.rating}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;
