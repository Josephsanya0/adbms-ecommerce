import mysql from 'mysql2/promise';
import express from 'express';
import cors from 'cors';

const db_info = {
    host: 'localhost',
    user: 'root',
    password: 'hnk1597535!',
    database: 'ecommerce',
    port: 3307
};

const app = express();
app.use(express.json());
app.use(cors());

//test variables
let currentCustomerNo = null;


async function query(sql, params) {
    const connection = await mysql.createConnection(db_info);
    const [results, ] = await connection.execute(sql, params);
    connection.end();
    return results;
}


app.post('/api/passwordCheckCustomer', async (req, res) => {
    const { id } = req.body;
    
    try {
        const pwCheck = await query('SELECT Password, CustomerNo FROM customers WHERE ID = ?', [id]);

        if (pwCheck.length === 0) {
            console.warn(`ID ${id} does not exist`);
            return res.status(404).json({ error: 'ID does not exist' });
        }

        const { Password: user_pw, CustomerNo: customer_no } = pwCheck[0];

        console.log('Password:', user_pw);
        console.log('CustomerNo:', customer_no);

        currentCustomerNo = customer_no;

        res.json({
            userPw: user_pw
        });

    } catch (error) {
        console.error('Database error: ', error);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});


app.post('/api/passwordCheckVendor', async (req, res) => {
    const { id } = req.body;
    
    try {
        const pwCheck = await query('SELECT Password FROM vendors WHERE ID = ?', [id]);

        if (pwCheck.length === 0) {
            console.warn(`ID ${id} does not exist`);
            return res.status(404).json({ error: 'ID does not exist' });
        }

        const { Password: user_pw } = pwCheck[0];

        console.log('password is: ', pwCheck[0]);

        res.json({
            userPw: user_pw
        });

    } catch (error) {
        console.error('Database error: ', error);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});


app.post('/api/addCustomer', async (req, res) => {
    const { firstName, lastName, id, password, email, phone, address } = req.body;

    try {
        const result = await query('SELECT MAX(customerNo) AS maxCustomerNo FROM customers');
        const maxCustomerNo = result[0].maxCustomerNo || 0;

        const newCustomerNo = maxCustomerNo + 1;

        await query(
            'INSERT INTO customers (CustomerNo, FirstName, LastName, ID, Password, Email, Phone, Address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [newCustomerNo, firstName, lastName, id, password, email, phone, address]
        );

        console.log(`Customer added with customerNo: ${newCustomerNo}`);
        res.json({ message: 'Customer added successfully', customerNo: newCustomerNo });
    } catch (error) {
        console.error('Error adding customer:', error.message, error.stack);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});


app.put('/api/updateCustomer/:customerNo', async (req, res) => {
    const customerNo = req.params.customerNo;
    const { firstName, lastName, id, password, email, phone, address } = req.body;

    try {
        const result = await query(
            `UPDATE customers
             SET FirstName = ?, LastName = ?, ID = ?, Password = ?, Email = ?, Phone = ?, Address = ?
             WHERE CustomerNo = ?`,
            [firstName, lastName, id, password, email, phone, address, customerNo]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        console.log(`Customer updated with customerNo: ${customerNo}`);
        res.json({ message: 'Customer updated successfully' });
    } catch (error) {
        console.error('Error updating customer:', error.message, error.stack);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});


app.delete('/api/deleteCustomer/:customerNo', async (req, res) => {
    const customerNo = req.params.customerNo;

    try {
        const result = await query(
            `DELETE FROM customers
             WHERE CustomerNo = ?`,
            [customerNo]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        console.log(`Customer deleted with customerNo: ${customerNo}`);
        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        console.error('Error deleting customer:', error.message, error.stack);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});


app.post('/api/addVendor', async (req, res) => {
    const { businessName, representative, id, password, email, phone, address } = req.body;

    try {
        const result = await query('SELECT MAX(VendorNo) AS maxVendorNo FROM vendors');
        const maxVendorNo = result[0].maxVendorNo || 0;

        const newVendorNo = maxVendorNo + 1;

        await query(
            'INSERT INTO vendors (VendorNo, BusinessName, Representative, ID, Password, Email, Phone, Address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [newVendorNo, businessName, representative, id, password, email, phone, address]
        );

        console.log(`Vendor added with vendorNo: ${newVendorNo}`);
        res.json({ message: 'Vendor added successfully', vendorNo: newVendorNo });
    } catch (error) {
        console.error('Error adding vendor:', error.message, error.stack);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});


app.put('/api/updateVendor/:vendorNo', async (req, res) => {
    const vendorNo = req.params.vendorNo;
    const { businessName, representative, id, password, email, phone, address } = req.body;

    try {
        const result = await query(
            `UPDATE vendors
             SET BusinessName = ?, Representative = ?, ID = ?, Password = ?, Email = ?, Phone = ?, Address = ?
             WHERE VendorNo = ?`,
            [businessName, representative, id, password, email, phone, address, vendorNo]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        console.log(`Vendor updated with vendorNo: ${vendorNo}`);
        res.json({ message: 'Vendor updated successfully' });
    } catch (error) {
        console.error('Error updating vendor:', error.message, error.stack);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});


app.delete('/api/deleteVendor/:vendorNo', async (req, res) => {
    const vendorNo = req.params.vendorNo;

    try {
        const result = await query(
            `DELETE FROM vendors
             WHERE VendorNo = ?`,
            [vendorNo]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        console.log(`Vendor deleted with vendorNo: ${vendorNo}`);
        res.json({ message: 'Vendor deleted successfully' });
    } catch (error) {
        console.error('Error deleting vendor:', error.message, error.stack);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});


app.get('/api/searchProducts', async (req, res) => {
    const { keyword } = req.query;

    if (!keyword) {
        return res.status(400).json({ error: 'Keyword is required' });
    }

    const searchKeyword = `%${keyword}%`;

    try {
        const results = await query(
            `SELECT 
                 ProductID,
                 ProductName, 
                 Description, 
                 ROUND(ActualPrice, 2) AS ActualPrice, 
                 ROUND(DiscountedPrice, 2) AS DiscountedPrice
             FROM products
             WHERE ProductName LIKE ? OR Description LIKE ?`,
            [searchKeyword, searchKeyword]
        );

        res.json(results);
    } catch (error) {
        console.error('Database error:', error.message);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});


app.post('/api/addToCart', async (req, res) => {
    const { productId } = req.body;

    if (!productId) {
        return res.status(400).json({ error: 'Product ID is required' });
    }

    try {
        await query(
            `INSERT INTO cart (ProductID) VALUES (?)`,
            [productId]
        );
        res.json({ success: true, message: 'Product added to cart successfully!' });
    } catch (error) {
        console.error('Database error:', error.message);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});


//const customerNo = req.session.customerNo;

app.listen(3000, () => console.log(`Server running on http://localhost:${3000}`));