import { useState, useEffect } from 'react';
import Head from 'next/head';
import Navbar from './Navbar';
import { useRouter } from 'next/router';

export default function Layout({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const router = useRouter();

  // Pages where navbar should be hidden
  const noNavbarPages = ['/login', '/signup'];
  const hideNavbar = noNavbarPages.includes(router.pathname);

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
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      <Head>
        <title>NotInsta</title>
        <meta name="description" content="A modern social media platform" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {!hideNavbar && <Navbar isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />}
      
      <main className={`${!hideNavbar ? 'ml-16' : ''} flex-1 transition-all duration-300`}>
        {children}
      </main>
    </div>
  );
}