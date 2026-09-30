const { pool } = require('./config/database');

async function checkAndSeedLeaves() {
  try {
    const [leaves] = await pool.execute('SELECT * FROM leave_requests');
    console.log(`Current leave_requests count: ${leaves.length}`);

    const [users] = await pool.execute('SELECT id, name FROM users WHERE role != "admin"');
    console.log('Available users:', users);

    if (users.length > 0) {
      // Insert sample approved leave requests into leave_requests table
      const sampleLeaves = [
        {
          user_id: users[3 % users.length].id, // Citra Dewi
          reason: 'Izin Urusan Keluarga',
          description: 'Acara keluarga di luar kota',
          status: 'approved',
          created_at: '2026-09-01 08:00:00',
        },
        {
          user_id: users[4 % users.length].id, // Dimas Prasetyo
          reason: 'Izin Sakit',
          description: 'Sakit demam dan flu, istirahat dokter',
          status: 'approved',
          created_at: '2026-09-04 08:00:00',
        },
        {
          user_id: users[1 % users.length].id, // Ahmad Fauzi
          reason: 'Izin Dinas Luar',
          description: 'Kunjungan kerja ke cabang Surabaya',
          status: 'approved',
          created_at: '2026-09-15 08:00:00',
        },
      ];

      for (const sl of sampleLeaves) {
        await pool.execute(
          `INSERT INTO leave_requests (user_id, reason, description, status, reviewed_by, reviewed_at, created_at)
           VALUES (?, ?, ?, ?, 1, NOW(), ?)`,
          [sl.user_id, sl.reason, sl.description, sl.status, sl.created_at]
        );
      }
      console.log('✅ Successfully inserted 3 sample approved leaves into leave_requests table!');
    }
    process.exit(0);
  } catch (err) {
    console.error('Error seeding leaves:', err);
    process.exit(1);
  }
}

checkAndSeedLeaves();
