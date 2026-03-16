const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkSubscription = require('../middleware/checkSubscription');
const tenantMiddleware = require('../middleware/tenant');
const {
  holdAdvanceSalary,
  releaseAdvanceSalary,
  deductAdvanceSalary,
  getAdvanceSalaryRecords,
  setPFDeduction,
  deductEmployerPF,
  getPFDeductionRecords,
  markPFDeducted,
  calculateMonthlySalary,
  processMonthlySalary,
  addBonus,
  getBonusRecords,
  updateBonusStatus,
  deleteBonus,
  addHoliday,
  getHolidays,
  updateHoliday,
  deleteHoliday,
  checkHolidayForDate
} = require('../controllers/salaryController');

const adminManager = auth(['RESTAURANT_ADMIN', 'MANAGER']);

// Advance Salary
router.post('/advance/hold/:staffId',        adminManager, checkSubscription, tenantMiddleware, holdAdvanceSalary);
router.patch('/advance/release/:recordId',   adminManager, checkSubscription, tenantMiddleware, releaseAdvanceSalary);
router.patch('/advance/deduct/:recordId',    adminManager, checkSubscription, tenantMiddleware, deductAdvanceSalary);
router.get('/advance/all',                   adminManager, checkSubscription, tenantMiddleware, getAdvanceSalaryRecords);
router.get('/advance/:staffId',              adminManager, checkSubscription, tenantMiddleware, getAdvanceSalaryRecords);

// PF Deduction
router.post('/pf/enable/:staffId',           adminManager, checkSubscription, tenantMiddleware, setPFDeduction);
router.patch('/pf/deduct-employer/:staffId', adminManager, checkSubscription, tenantMiddleware, deductEmployerPF);
router.patch('/pf/mark-deducted/:recordId',  adminManager, checkSubscription, tenantMiddleware, markPFDeducted);
router.get('/pf/all',                        adminManager, checkSubscription, tenantMiddleware, getPFDeductionRecords);
router.get('/pf/:staffId',                   adminManager, checkSubscription, tenantMiddleware, getPFDeductionRecords);

// Monthly Salary Processing
router.get('/calculate/:staffId',            adminManager, checkSubscription, tenantMiddleware, calculateMonthlySalary);
router.post('/process/:staffId',             adminManager, checkSubscription, tenantMiddleware, processMonthlySalary);

// Bonus Management
router.post('/bonus/add/:staffId',           adminManager, checkSubscription, tenantMiddleware, addBonus);
router.get('/bonus/all',                     adminManager, checkSubscription, tenantMiddleware, getBonusRecords);
router.get('/bonus/:staffId',                adminManager, checkSubscription, tenantMiddleware, getBonusRecords);
router.patch('/bonus/status/:bonusId',       adminManager, checkSubscription, tenantMiddleware, updateBonusStatus);
router.delete('/bonus/:bonusId',             adminManager, checkSubscription, tenantMiddleware, deleteBonus);

// Holiday Management
router.post('/holiday/add',                  adminManager, checkSubscription, tenantMiddleware, addHoliday);
router.get('/holiday/all',                   adminManager, checkSubscription, tenantMiddleware, getHolidays);
router.put('/holiday/:holidayId',            adminManager, checkSubscription, tenantMiddleware, updateHoliday);
router.delete('/holiday/:holidayId',         adminManager, checkSubscription, tenantMiddleware, deleteHoliday);
router.get('/holiday/check',                 adminManager, checkSubscription, tenantMiddleware, checkHolidayForDate);

module.exports = router;
