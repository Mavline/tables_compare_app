import React from 'react';
import { Link } from 'react-router-dom';

const Navigation: React.FC = () => {
  return (
    <nav style={{
      backgroundColor: '#161B22',
      padding: '15px',
      width: '100%',
      position: 'fixed',
      top: 0,
      zIndex: 1000,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <Link 
          to="/" 
          style={{
            color: '#7E57C2',
            textDecoration: 'none',
            fontSize: '18px',
            fontWeight: 'bold',
            padding: '5px 15px',
            borderRadius: '4px',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = '#1C2128';
            e.currentTarget.style.color = '#A78BFA';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#7E57C2';
          }}
        >
          MAIN
        </Link>
        <Link 
          to="/docs" 
          style={{
            color: '#7E57C2',
            textDecoration: 'none',
            fontSize: '18px',
            fontWeight: 'bold',
            padding: '5px 15px',
            borderRadius: '4px',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = '#1C2128';
            e.currentTarget.style.color = '#A78BFA';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#7E57C2';
          }}
        >
          DOCS
        </Link>
      </div>
    </nav>
  );
};

export default Navigation; 