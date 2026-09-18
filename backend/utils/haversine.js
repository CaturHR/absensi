/**
 * Menghitung jarak antara dua titik koordinat GPS menggunakan Formula Haversine.
 *
 * Formula Haversine menghitung jarak "great-circle" antara dua titik
 * di permukaan bola (bumi), berdasarkan latitude dan longitude mereka.
 *
 * @param {number} lat1 - Latitude titik pertama (dalam derajat)
 * @param {number} lon1 - Longitude titik pertama (dalam derajat)
 * @param {number} lat2 - Latitude titik kedua (dalam derajat)
 * @param {number} lon2 - Longitude titik kedua (dalam derajat)
 * @returns {number} Jarak dalam meter
 */
const haversine = (lat1, lon1, lat2, lon2) => {
  // Radius bumi dalam meter (mean radius)
  const R = 6371000;

  // Konversi derajat ke radian
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);

  // Formula Haversine
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;

  return Math.round(distance * 100) / 100; // Pembulatan ke 2 desimal (cm precision)
};

module.exports = haversine;
