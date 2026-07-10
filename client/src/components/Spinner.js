import React from 'react';

function Spinner({ size = 'md', text = '' }) {
  const sizeClass = `spinner-${size}`;
  return (
    <div className="spinner-wrapper" role="status" aria-label={text || 'Loading'}>
      <div className={`spinner ${sizeClass}`}>
        <div className="spinner-blade" />
      </div>
      {text && <span className="spinner-text">{text}</span>}
    </div>
  );
}

export default Spinner;
