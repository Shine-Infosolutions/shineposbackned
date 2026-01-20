const { validationResult } = require('express-validator');
const TenantModelFactory = require('../models/TenantModelFactory');

const createTable = async (req, res) => {
    try {
        const { tableNumber, capacity, location, status } = req.body;
        const Table = TenantModelFactory.getTableModel(req.user.restaurantSlug);
        
        const existingTable = await Table.findOne({ tableNumber });
        if (existingTable) {
            return res.status(400).json({ error: 'Table number already exists' });
        }

        const table = new Table({ tableNumber, capacity, location, status });
        await table.save();
        
        res.status(201).json({ message: 'Table created successfully', table });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create table' });
    }
};

const getTables = async (req, res) => {
    try {
        const Table = TenantModelFactory.getTableModel(req.user.restaurantSlug);
        const { status, location, isActive } = req.query;
        
        let filter = {};
        if (status) filter.status = status;
        if (location) filter.location = location;
        if (isActive !== undefined) filter.isActive = isActive === 'true';
        
        const tables = await Table.find(filter).sort({ tableNumber: 1 });
        res.json({ tables });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tables' });
    }
};

const getTableById = async (req, res) => {
    try {
        const { id } = req.params;
        const Table = TenantModelFactory.getTableModel(req.user.restaurantSlug);
        
        const table = await Table.findById(id);
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }
        
        res.json({ table });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch table' });
    }
};

const updateTable = async (req, res) => {
    try {
        const { id } = req.params;
        const { tableNumber, capacity, location, status, isActive } = req.body;
        const Table = TenantModelFactory.getTableModel(req.user.restaurantSlug);
        
        if (tableNumber) {
            const existingTable = await Table.findOne({ tableNumber, _id: { $ne: id } });
            if (existingTable) {
                return res.status(400).json({ error: 'Table number already exists' });
            }
        }
        
        const table = await Table.findById(id);
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }
        
        if (tableNumber !== undefined) table.tableNumber = tableNumber;
        if (capacity !== undefined) table.capacity = capacity;
        if (location !== undefined) table.location = location;
        if (status !== undefined) table.status = status;
        if (isActive !== undefined) table.isActive = isActive;
        
        await table.save();
        
        res.json({ message: 'Table updated successfully', table });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update table' });
    }
};

const updateTableStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const Table = TenantModelFactory.getTableModel(req.user.restaurantSlug);
        
        const table = await Table.findById(id);
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }
        
        table.status = status;
        const savedTable = await table.save();
        
        res.json({ message: 'Table status updated successfully', table: savedTable });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update table status' });
    }
};

const deleteTable = async (req, res) => {
    try {
        const { id } = req.params;
        const Table = TenantModelFactory.getTableModel(req.user.restaurantSlug);
        
        const table = await Table.findByIdAndDelete(id);
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }
        
        res.json({ message: 'Table deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete table' });
    }
};

const getAvailableTables = async (req, res) => {
    try {
        const Table = TenantModelFactory.getTableModel(req.user.restaurantSlug);
        const tables = await Table.find({ 
            status: 'AVAILABLE', 
            isActive: true 
        }).sort({ tableNumber: 1 });
        
        res.json({ tables });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch available tables' });
    }
};

const transferTable = async (req, res) => {
    try {
        const { orderId, newTableId } = req.body;
        const Table = TenantModelFactory.getTableModel(req.user.restaurantSlug);
        const Order = TenantModelFactory.getOrderModel(req.user.restaurantSlug);
        const KOT = TenantModelFactory.getKOTModel(req.user.restaurantSlug);
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        const oldTableId = order.tableId;
        if (!oldTableId) {
            return res.status(400).json({ error: 'Order has no table assigned' });
        }
        
        const oldTable = await Table.findById(oldTableId);
        const newTable = await Table.findById(newTableId);
        
        if (!oldTable || !newTable) {
            return res.status(404).json({ error: 'Table not found' });
        }
        
        if (newTable.status !== 'AVAILABLE') {
            return res.status(400).json({ error: 'New table is not available' });
        }
        
        order.tableId = newTableId;
        order.tableNumber = newTable.tableNumber;
        await order.save();

        await KOT.updateMany(
            { orderId: orderId },
            { 
                tableId: newTableId,
                tableNumber: newTable.tableNumber 
            }
        );

        oldTable.status = 'MAINTENANCE';
        await oldTable.save();

        newTable.status = 'OCCUPIED';
        await newTable.save();
        
        res.json({ 
            message: 'Table transferred successfully',
            order,
            oldTable: { id: oldTable._id, number: oldTable.tableNumber, status: 'MAINTENANCE' },
            newTable: { id: newTable._id, number: newTable.tableNumber, status: 'OCCUPIED' }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to transfer table' });
    }
};

module.exports = {
    createTable,
    getTables,
    getTableById,
    updateTable,
    updateTableStatus,
    deleteTable,
    getAvailableTables,
    transferTable
};




