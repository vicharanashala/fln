const bcrypt = {
  hashSync: () => '$2b$test-only-route-check',
  compare: async () => false,
};

export default bcrypt;
