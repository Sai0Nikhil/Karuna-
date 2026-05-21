import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-teal-700 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4 md:px-8 flex items-center gap-4">
        <div className="text-3xl">🐾</div>
        <div>
          <h1 className="text-3xl font-bold text-white font-adlam">
            Karuṇā
          </h1>
        </div>
      </div>
    </header>
  );
};