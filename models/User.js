'use strict';
const { DataTypes } = require('sequelize');
const { sequelize } = require('./db'); 

// تعريف موديل المستخدم
const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  is_approved: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_admin: { type: DataTypes.BOOLEAN, defaultValue: false },
  fingerprint: { type: DataTypes.STRING, defaultValue: null },
  solve_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  last_login: { type: DataTypes.DATE, defaultValue: null }
}, {
  tableName: 'users', // نحدد اسم الجدول بالظبط
  timestamps: true    // بيكريت createdAt و updatedAt لوحده
});

// تعريف موديل السجلات
const SolveLog = sequelize.define('SolveLog', {
  grid_json: { type: DataTypes.TEXT },
  move: { type: DataTypes.STRING(10) },
  score: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
  tableName: 'solve_logs'
});

// العلاقات
User.hasMany(SolveLog, { foreignKey: 'user_id' });
SolveLog.belongsTo(User, { foreignKey: 'user_id' });

// دوال مساعدة (Helper Functions) عشان الكود القديم بتاعك ما يضربش
User.findByUsername = (username) => User.findOne({ where: { username } });
User.findById = (id) => User.findByPk(id);
User.createOld = (username, password) => User.create({ username, password }); // سميتها createOld عشان متلخبطش
User.updateLastLogin = (id) => User.update({ last_login: new Date() }, { where: { id } });

module.exports = { User, SolveLog };
