import Head from 'next/head';
import Navbar from './Navbar';
import { useState, useEffect } from 'react';

export default function Layout({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check local storage for dark mode preference
    const darkModePreference = localStorage.getItem('darkMode');
    setIsDarkMode(darkModePreference === 'true');

    // Apply initial dark mode class
    if (darkModePreference === 'true') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="min-h-screen">
      <Head>
        <title>NotReddit</title>
        <meta name="description" content="A modern social media platform" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="flex">
        <Navbar isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
        <main className="flex-1 ml-16">
          {children}
        </main>
      </div>
    </div>
  );
}