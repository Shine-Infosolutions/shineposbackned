const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
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
        
        let responseData = { message: 'Table status updated successfully', table: savedTable };
        
        // Check if table marked as MAINTENANCE is part of merged group
        if (status === 'MAINTENANCE') {
            const mergedTable = await Table.findOne({ 
                mergedWith: id,
                tableNumber: /^MG_T\d+$/,
                status: { $ne: 'MAINTENANCE' }
            });
            
            if (mergedTable) {
                responseData.mergedGroupAlert = {
                    message: 'Table is part of merged group - replacement needed',
                    mergedTableId: mergedTable._id,
                    mergedTableNumber: mergedTable.tableNumber,
                    requiresReplacement: true
                };
            }
        }
        
        res.json(responseData);
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

const mergeTables = async (req, res) => {
    try {
        const { tableIds, guestCount } = req.body;
        const Table = TenantModelFactory.getTableModel(req.user.restaurantSlug);
        
        if (!tableIds || tableIds.length < 2) {
            return res.status(400).json({ error: 'At least 2 tables required for merge' });
        }
        
        const tables = await Table.find({ _id: { $in: tableIds } });
        
        if (tables.length !== tableIds.length) {
            return res.status(404).json({ error: 'One or more tables not found' });
        }
        
        const unavailableTables = tables.filter(t => t.status !== 'AVAILABLE');
        if (unavailableTables.length > 0) {
            return res.status(400).json({ 
                error: 'All tables must be available for merge',
                unavailableTables: unavailableTables.map(t => t.tableNumber)
            });
        }
        
        const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
        
        if (guestCount > totalCapacity) {
            return res.status(400).json({ 
                error: `Guest count (${guestCount}) exceeds total capacity (${totalCapacity})`
            });
        }
        
        const mergedTables = await Table.find({ tableNumber: /^MG_T\d+$/ }).sort({ tableNumber: -1 }).limit(1);
        let mergeNumber = 1;
        if (mergedTables.length > 0) {
            const lastNumber = parseInt(mergedTables[0].tableNumber.replace('MG_T', ''));
            mergeNumber = lastNumber + 1;
        }
        const mergedTableNumber = `MG_T${String(mergeNumber).padStart(2, '0')}`;
        
        const mergedTable = new Table({
            tableNumber: mergedTableNumber,
            capacity: totalCapacity,
            location: tables[0].location,
            status: 'OCCUPIED',
            mergedWith: tableIds,
            mergedGuestCount: guestCount
        });
        const savedMergedTable = await mergedTable.save();
        console.log('Merged table saved:', savedMergedTable);
        
        // Update each original table individually by fetching and saving
        console.log('Updating original tables to OCCUPIED:', tableIds);
        for (const tableId of tableIds) {
            const table = await Table.findById(tableId);
            if (table) {
                table.status = 'OCCUPIED';
                await table.save();
                console.log('Updated table:', table.tableNumber, 'to OCCUPIED');
            }
        }
        
        res.json({ 
            message: 'Tables merged successfully',
            mergedTable: savedMergedTable,
            originalTables: tables.map(t => t.tableNumber),
            totalCapacity,
            guestCount
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to merge tables' });
    }
};

const getReplacementOptions = async (req, res) => {
    try {
        const { brokenTableId } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(brokenTableId)) {
            return res.status(400).json({ error: 'Invalid brokenTableId format' });
        }
        
        const Table = TenantModelFactory.getTableModel(req.user.restaurantSlug);
        
        const brokenTable = await Table.findById(brokenTableId);
        if (!brokenTable) {
            return res.status(404).json({ error: 'Broken table not found' });
        }
        
        const mergedTable = await Table.findOne({ 
            mergedWith: brokenTableId,
            tableNumber: /^MG_T\d+$/,
            status: { $ne: 'MAINTENANCE' }
        });
        
        if (!mergedTable) {
            return res.status(400).json({ error: 'Table is not part of any active merged group' });
        }
        
        const replacementOptions = await Table.find({
            status: 'AVAILABLE',
            isActive: true,
            capacity: { $gte: Math.floor(brokenTable.capacity * 0.8) },
            _id: { $nin: mergedTable.mergedWith },
            tableNumber: { $not: /^MG_T\d+$/ }
        }).sort({ capacity: 1 }).limit(5);
        
        if (replacementOptions.length === 0) {
            return res.status(400).json({ error: 'No suitable replacement tables available' });
        }
        
        res.json({
            brokenTable: { id: brokenTable._id, number: brokenTable.tableNumber, capacity: brokenTable.capacity },
            mergedTable: { id: mergedTable._id, number: mergedTable.tableNumber },
            replacementOptions: replacementOptions.map(table => ({
                id: table._id,
                number: table.tableNumber,
                capacity: table.capacity,
                location: table.location
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get replacement options' });
    }
};

const transferAndMerge = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        const { brokenTableId, replacementTableId } = req.body;
        
        if (!brokenTableId || !replacementTableId) {
            return res.status(400).json({ error: 'brokenTableId and replacementTableId are required' });
        }
        
        if (!mongoose.Types.ObjectId.isValid(brokenTableId) || !mongoose.Types.ObjectId.isValid(replacementTableId)) {
            return res.status(400).json({ error: 'Invalid table ID format' });
        }
        
        const Table = TenantModelFactory.getTableModel(req.user.restaurantSlug);
        const Order = TenantModelFactory.getOrderModel(req.user.restaurantSlug);
        const KOT = TenantModelFactory.getKOTModel(req.user.restaurantSlug);
        
        const brokenTable = await Table.findById(brokenTableId).session(session);
        if (!brokenTable) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Broken table not found' });
        }
        
        const mergedTable = await Table.findOne({ 
            mergedWith: brokenTableId,
            tableNumber: /^MG_T\d+$/,
            status: { $ne: 'MAINTENANCE' }
        }).session(session);
        
        if (!mergedTable) {
            await session.abortTransaction();
            return res.status(400).json({ error: 'Table is not part of any active merged group' });
        }
        
        const replacementTable = await Table.findById(replacementTableId).session(session);
        if (!replacementTable || replacementTable.status !== 'AVAILABLE') {
            await session.abortTransaction();
            return res.status(400).json({ error: 'Invalid replacement table' });
        }
        
        const newMergedWith = mergedTable.mergedWith.map(id => 
            id.toString() === brokenTableId ? replacementTable._id : id
        );
        
        const newTables = await Table.find({ _id: { $in: newMergedWith } }).session(session);
        const newTotalCapacity = newTables.reduce((sum, t) => sum + t.capacity, 0);
        
        const newMergedTableNumber = `MG_T${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
        const newMergedTable = new Table({
            tableNumber: newMergedTableNumber,
            capacity: newTotalCapacity,
            location: mergedTable.location,
            status: 'OCCUPIED',
            mergedWith: newMergedWith,
            mergedGuestCount: mergedTable.mergedGuestCount
        });
        const savedNewMergedTable = await newMergedTable.save({ session });
        
        const activeOrders = await Order.find({
            tableId: mergedTable._id,
            status: { $nin: ['COMPLETE', 'CANCELLED'] }
        }).session(session);
        
        await Order.updateMany(
            { _id: { $in: activeOrders.map(o => o._id) } },
            { tableId: savedNewMergedTable._id, tableNumber: savedNewMergedTable.tableNumber },
            { session }
        );
        
        await KOT.updateMany(
            { 
                $or: [
                    { orderId: { $in: activeOrders.map(o => o._id) } },
                    { tableId: mergedTable._id }
                ]
            },
            { 
                tableId: savedNewMergedTable._id,
                tableNumber: savedNewMergedTable.tableNumber 
            },
            { session }
        );
        
        await Table.updateMany(
            { _id: { $in: [brokenTableId, mergedTable._id] } },
            { status: 'MAINTENANCE' },
            { session }
        );
        
        const tableIdsToUpdate = newMergedWith.filter(id => id.toString() !== replacementTable._id.toString());
        await Table.updateMany(
            { _id: { $in: [...tableIdsToUpdate, replacementTableId] } },
            { status: 'OCCUPIED' },
            { session }
        );
        
        await session.commitTransaction();
        
        res.json({
            message: 'Merged table maintenance completed successfully',
            brokenTable: { id: brokenTableId, number: brokenTable.tableNumber },
            replacementTable: { id: replacementTable._id, number: replacementTable.tableNumber },
            oldMergedTable: { id: mergedTable._id, number: mergedTable.tableNumber },
            newMergedTable: { id: savedNewMergedTable._id, number: savedNewMergedTable.tableNumber },
            ordersTransferred: activeOrders.length
        });
        
    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({ error: 'Failed to handle merged table maintenance' });
    } finally {
        session.endSession();
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
    transferTable,
    mergeTables,
    getReplacementOptions,
    transferAndMerge
};




