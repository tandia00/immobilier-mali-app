export const formatPrice = (price) => {
  if (!price) return '0';
  return price.toLocaleString('fr-FR');
};

export const formatRelativeTime = (date) => {
  if (!date) return '';
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) {
    return minutes <= 1 ? 'Il y a 1 minute' : `Il y a ${minutes} minutes`;
  } else if (hours < 24) {
    return hours === 1 ? 'Il y a 1 heure' : `Il y a ${hours} heures`;
  } else if (days < 30) {
    return days === 1 ? 'Il y a 1 jour' : `Il y a ${days} jours`;
  } else {
    const date = new Date(date);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
};
