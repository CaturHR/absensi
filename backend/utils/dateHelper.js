/**
 * Helper tanggal dan zona waktu Indonesia (WIB / Asia/Jakarta).
 */

/**
 * Mendapatkan rentang waktu hari ini dalam zona waktu WIB (Asia/Jakarta).
 * Rentang waktu harian: 00:00:00 s/d 23:59:59 WIB.
 * @returns {{ todayStr: string, startOfDay: string, endOfDay: string }}
 */
function getTodayRangeWIB() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' });
  const todayStr = formatter.format(now); // Format: YYYY-MM-DD
  const startOfDay = `${todayStr} 00:00:00`;
  const endOfDay = `${todayStr} 23:59:59`;
  return { todayStr, startOfDay, endOfDay };
}

module.exports = {
  getTodayRangeWIB,
};
