export const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Invalid date'; // Handle missing timestamps
  
    // Convert timestamp to Date object if necessary
    const postedDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(postedDate)) return 'Invalid date';
  
    const now = new Date();
    const seconds = Math.floor((now - postedDate) / 1000);
  
    if (seconds < 60) return 'Just now';
  
    const intervals = [
      { label: 'y', seconds: 31536000 },
      { label: 'mo', seconds: 2592000 },
      { label: 'd', seconds: 86400 },
      { label: 'h', seconds: 3600 },
      { label: 'm', seconds: 60 }
    ];
  
    for (const { label, seconds: unit } of intervals) {
      const interval = Math.floor(seconds / unit);
      if (interval >= 1) return `${interval}${label} ago`;
    }
  };
  