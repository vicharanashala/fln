async function testSubmit() {
  const url = 'http://localhost:3000/api/students/s1/diagnostic/submit';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer superadmin@fln.org'
  };

  const payload = {
    questions: [
      { question_id: 'diag_q_0_0', question: 'Count stars', answer: '3', source_level: 2 },
      { question_id: 'diag_q_0_1', question: 'Compare groups', answer: 'A', source_level: 2 }
    ],
    answers: {
      'diag_q_0_0': '3',
      'diag_q_0_1': 'B' // wrong answer
    }
  };

  try {
    console.log('Submitting diagnostic...');
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testSubmit();
