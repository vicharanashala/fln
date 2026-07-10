const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await User.findOne({ email: email.toLowerCase(), isActive: true });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    user.lastLogin = new Date();
    await user.save();
    await Logbook.create({
      action: 'login',
      performedBy: user._id,
      performedByRole: user.role,
      description: `${user.email} logged in`,
      ipAddress: req.ip
    });
    res.json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        school: user.school,
        assignedClasses: user.assignedClasses,
        assignedSchools: user.assignedSchools
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('school')
      .populate('assignedClasses')
      .populate('assignedSchools');
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
};

const Logbook = require('../models/Logbook');
