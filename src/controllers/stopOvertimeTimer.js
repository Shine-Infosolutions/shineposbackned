const stopOvertimeTimer = async (req, res) => {
  try {
    const { requestId } = req.params;
    const restaurantSlug = req.user.restaurantSlug;
    const OvertimeModel = TenantModelFactory.getOvertimeModel(restaurantSlug);
    
    const overtime = await OvertimeModel.findById(requestId);
    if (!overtime) {
      return res.status(404).json({ error: 'Overtime request not found' });
    }
    
    if (overtime.status !== 'in-progress') {
      return res.status(400).json({ error: 'Overtime is not in progress' });
    }
    
    const stoppedAt = new Date();
    const actualHours = (stoppedAt - overtime.startedAt) / (1000 * 60 * 60);
    const h = Math.floor(actualHours);
    const m = Math.round((actualHours - h) * 60);
    const s = Math.round(((actualHours - h) * 60 - m) * 60);
    
    overtime.completedAt = stoppedAt;
    overtime.actualHoursWorked = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    overtime.status = 'completed';
    overtime.amount = Math.round((actualHours * (overtime.rate || 0)) * 100) / 100;
    
    await overtime.save();
    
    res.json({
      message: 'Overtime stopped and completed',
      overtime,
      summary: {
        assignedHours: parseFloat(overtime.hours),
        actualHours: actualHours.toFixed(2),
        actualHoursFormatted: overtime.actualHoursWorked,
        startedAt: overtime.startedAt,
        stoppedAt: stoppedAt,
        totalAmount: overtime.amount,
        rate: overtime.rate
      }
    });
  } catch (error) {
    console.error('Stop overtime timer error:', error);
    res.status(500).json({ error: 'Failed to stop overtime timer' });
  }
};

module.exports = stopOvertimeTimer;
