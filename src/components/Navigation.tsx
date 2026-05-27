import React from 'react';
import { Link } from 'react-router-dom';

const linkStyle: React.CSSProperties = {
  color: '#7E57C2',
  textDecoration: 'none',
  fontSize: '18px',
  fontWeight: 'bold',
  padding: '5px 15px',
  borderRadius: '4px',
  transition: 'all 0.3s ease'
};

const handleMouseEnter = (event: React.MouseEvent<HTMLAnchorElement>) => {
  event.currentTarget.style.backgroundColor = '#1C2128';
  event.currentTarget.style.color = '#A78BFA';
};

const handleMouseLeave = (event: React.MouseEvent<HTMLAnchorElement>) => {
  event.currentTarget.style.backgroundColor = 'transparent';
  event.currentTarget.style.color = '#7E57C2';
};

const Navigation: React.FC = () => {
  return (
    <nav style={{
      backgroundColor: '#161B22',
      padding: '15px',
      width: '100%',
      position: 'fixed',
      top: 0,
      zIndex: 1000,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      boxSizing: 'border-box'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '20px',
        flexWrap: 'wrap',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <Link
          to="/elisra"
          style={linkStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          Elisra
        </Link>
        <Link
          to="/ast"
          style={linkStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          AST
        </Link>
        <Link
          to="/about"
          style={linkStyle}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          ABOUT
        </Link>
      </div>
    </nav>
  );
};

export default Navigation;
