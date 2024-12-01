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

async function query(sql, params) {
    const connection = await mysql.createConnection(db_info);
    const [results, ] = await connection.execute(sql, params);
    connection.end();
    return results;
}

app.post('/api/passwordCheckCustomer', async (req, res) => {
    const { id } = req.body;
    
    try {
        const pwCheck = await query('SELECT Password, CustomerNo, ID AS CustomerID FROM customers WHERE ID = ?', [id]);

        if (pwCheck.length === 0) {
            console.warn(`ID ${id} does not exist`);
            return res.status(404).json({ error: 'ID does not exist' });
        }

        const { Password: user_pw, CustomerNo: customer_no, CustomerID: customer_id } = pwCheck[0];

        console.log('Password:', user_pw);
        console.log('CustomerNo:', customer_no);
        console.log('CustomerID:', customer_id);
        res.json({
            userPw: user_pw,
            customerNo: customer_no,
            customerID: customer_id,
        });

    } catch (error) {
        console.error('Database error: ', error);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});

app.post('/api/logLogin', async (req, res) => {
    const { customerNo } = req.body;

    if (!customerNo) {
        return res.status(400).json({ error: 'CustomerNo is required.' });
    }

    try {
        const currentDate = new Date();
        const result = await query('SELECT MAX(LogNo) AS maxLogNo FROM logs');
        const maxLogNo = result[0]?.maxLogNo || 0;
        const newLogNo = maxLogNo + 1;

        await query(
            'INSERT INTO logs (LogNo, LogCustomerNo, LogDate) VALUES (?, ?, ?)',
            [newLogNo, customerNo, currentDate]
        );

        console.log(`Log added: LogNo=${newLogNo}, LogCustomerNo=${customerNo}, LogDate=${currentDate}`);
        res.json({ message: 'Log saved successfully!' });
    } catch (error) {
        console.error('Error saving log:', error.message, error.stack);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.post('/api/addCustomer', async (req, res) => {
    const { firstName, lastName, id, password, email, phone } = req.body;
    console.log('Request body:', req.body);

    try {
        const result = await query('SELECT MAX(customerNo) AS maxCustomerNo FROM customers');
        const maxCustomerNo = result[0]?.maxCustomerNo || 0;
        const newCustomerNo = maxCustomerNo + 1;

        await query(
            'INSERT INTO customers (CustomerNo, FirstName, LastName, ID, Password, Email, Phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [newCustomerNo, firstName, lastName, id, password, email, phone]
        );

        console.log(`Customer added with customerNo: ${newCustomerNo}`);
        res.json({ message: 'Customer added successfully', customerNo: newCustomerNo });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            console.error('Duplicate ID error:', error.message);
            res.status(400).json({ error: 'ID already exists. Please choose a different ID.' });
        } else {
            console.error('Error adding customer:', error.message, error.stack);
            res.status(500).json({ error: 'An internal server error occurred' });
        }
    }
});

app.get('/api/getCustomer/:customerNo', async (req, res) => {
    const customerNo = req.params.customerNo;
    console.log('Logined customer number:', customerNo);

    try {
        const result = await query('SELECT FirstName, LastName, ID, Email, Phone FROM customers WHERE CustomerNo = ?', [customerNo]);

        if (result.length === 0) {
            return res.status(404).json({ error: 'Customer not found.' });
        }

        console.log('Query result:', result[0]);
        res.json(result[0]);
    } catch (error) {
        console.error('Error fetching customer:', error.message, error.stack);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});

app.put('/api/updateCustomer', async (req, res) => {
    const { firstName, lastName, password, email, phone } = req.body;

    const customerNo = req.headers['customer-no'];

    if (!customerNo) {
        return res.status(400).json({ error: 'Customer number is required' });
    }

    try {
        const result = await query(
            `UPDATE customers
             SET FirstName = ?, LastName = ?, Password = ?, Email = ?, Phone = ?
             WHERE CustomerNo = ?`,
            [firstName, lastName, password, email, phone, customerNo]
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

app.post('/api/addToWishlist', async (req, res) => {
    const { customerNo, productId } = req.body;

    if (!customerNo || !productId) {
        return res.status(400).json({ error: 'CustomerNo and ProductID are required.' });
    }

    try {
        const existingWishlist = await query(
            'SELECT 1 FROM wishlists WHERE CustomerNo = ? AND ProductID = ?',
            [customerNo, productId]
        );

        if (existingWishlist.length > 0) {
            console.log(`Product already in wishlist: CustomerNo=${customerNo}, ProductID=${productId}`);
            return res.status(200).json({ message: 'This product is already in the wishlist.' });
        }

        await query(
            'INSERT INTO wishlists (CustomerNo, ProductID) VALUES (?, ?)',
            [customerNo, productId]
        );

        console.log(`Wishlist item added: CustomerNo=${customerNo}, ProductID=${productId}`);
        res.json({ message: 'Added to wishlist successfully!' });
    } catch (error) {
        console.error('Error adding to wishlist:', error.message, error.stack);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.post('/api/removeFromWishlist', async (req, res) => {
    const { customerNo, productId } = req.body;

    if (!customerNo || !productId) {
        return res.status(400).json({ error: 'CustomerNo and ProductID are required.' });
    }

    try {
        const result = await query(
            'DELETE FROM wishlists WHERE CustomerNo = ? AND ProductID = ?',
            [customerNo, productId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Wishlist item not found.' });
        }

        console.log(`Wishlist item removed: CustomerNo=${customerNo}, ProductID=${productId}`);
        res.json({ message: 'Removed from wishlist successfully!' });
    } catch (error) {
        console.error('Error removing from wishlist:', error.message, error.stack);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.get('/api/getWishlist', async (req, res) => {
    const { customerNo } = req.query;

    if (!customerNo) {
        return res.status(400).json({ error: 'CustomerNo is required.' });
    }

    try {
        const wishlistItems = await query(
            `SELECT 
                p.ProductID,
                p.ProductName,
                p.Description,
                ROUND(p.ActualPrice, 2) AS ActualPrice,
                ROUND(p.DiscountedPrice, 2) AS DiscountedPrice
             FROM wishlists w
             JOIN products p ON w.ProductID = p.ProductID
             WHERE w.CustomerNo = ?`,
            [customerNo]
        );

        res.json(wishlistItems);
    } catch (error) {
        console.error('Error fetching wishlist:', error.message, error.stack);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.get('/api/getWishlistState', async (req, res) => {
    const { customerNo } = req.query;

    if (!customerNo) {
        return res.status(400).json({ error: 'CustomerNo is required.' });
    }

    try {
        const wishlistItems = await query(
            `SELECT ProductID FROM wishlists WHERE CustomerNo = ?`,
            [customerNo]
        );

        res.json(wishlistItems.map(item => item.ProductID));
    } catch (error) {
        console.error('Error fetching wishlist state:', error.message, error.stack);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.post('/api/addToCart', async (req, res) => {
    const { productId } = req.body;
    const customerNo = req.headers['customer-no'];

    if (!customerNo || !productId) {
        return res.status(400).json({ error: 'CustomerNo and ProductID are required.' });
    }

    try {
        const [cart] = await query(
            'SELECT CartID FROM carts WHERE CustomerNo = ?',
            [customerNo]
        );

        let cartID;
        if (!cart) {
            cartID = parseInt(customerNo) + 100;

            await query(
                'INSERT INTO carts (CartID, CustomerNo, TotalAmount) VALUES (?, ?, 0)',
                [cartID, customerNo]
            );
        } else {
            cartID = cart.CartID;
        }

        const [existingItem] = await query(
            'SELECT Quantity FROM cart_items WHERE CartID = ? AND ProductID = ?',
            [cartID, productId]
        );

        if (existingItem) {
            await query(
                `UPDATE cart_items 
                 SET Quantity = Quantity + 1, 
                     Subtotal = Subtotal + (SELECT DiscountedPrice FROM products WHERE ProductID = ?)
                 WHERE CartID = ? AND ProductID = ?`,
                [productId, cartID, productId]
            );
        } else {
            const [product] = await query(
                'SELECT DiscountedPrice FROM products WHERE ProductID = ?',
                [productId]
            );
            const discountedPrice = product.DiscountedPrice;

            await query(
                `INSERT INTO cart_items (CartID, ProductID, Quantity, Subtotal) 
                 VALUES (?, ?, 1, ?)`,
                [cartID, productId, discountedPrice]
            );
        }

        const [totalResult] = await query(
            'SELECT SUM(Subtotal) AS TotalAmount FROM cart_items WHERE CartID = ?',
            [cartID]
        );

        const totalAmount = totalResult.TotalAmount || 0;

        await query(
            'UPDATE carts SET TotalAmount = ? WHERE CartID = ?',
            [totalAmount, cartID]
        );

        res.json({ message: 'Product added to cart and total updated successfully!' });
    } catch (error) {
        console.error('Error adding to cart:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.get('/api/getCart', async (req, res) => {
    const { customerNo } = req.query;

    if (!customerNo) {
        return res.status(400).json({ error: 'CustomerNo is required.' });
    }

    try {
        const [cart] = await query(
            'SELECT CartID, TotalAmount FROM carts WHERE CustomerNo = ?',
            [customerNo]
        );

        if (!cart) {
            return res.status(404).json({ error: 'Cart not found for the given CustomerNo.' });
        }

        res.json(cart);
    } catch (error) {
        console.error('Error fetching cart:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.get('/api/getCartItems', async (req, res) => {
    const { cartID } = req.query;

    if (!cartID) {
        return res.status(400).json({ error: 'CartID is required.' });
    }

    try {
        const items = await query(
            `SELECT 
                ci.ProductID,
                p.ProductName,
                p.Description,
                p.DiscountedPrice,
                p.ActualPrice,
                ci.Quantity,
                (p.DiscountedPrice * ci.Quantity) AS Subtotal
             FROM cart_items ci
             JOIN products p ON ci.ProductID = p.ProductID
             WHERE ci.CartID = ?`,
            [cartID]
        );

        res.json(items);
    } catch (error) {
        console.error('Error fetching cart items:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});


app.post('/api/updateCartItem', async (req, res) => {
    const { cartID, productID, newQuantity } = req.body;

    if (!cartID || !productID) {
        return res.status(400).json({ error: 'CartID and ProductID are required.' });
    }

    try {
        if (newQuantity <= 0) {
            await query(
                'DELETE FROM cart_items WHERE CartID = ? AND ProductID = ?',
                [cartID, productID]
            );

            const [totalResult] = await query(
                'SELECT SUM(Subtotal) AS TotalAmount FROM cart_items WHERE CartID = ?',
                [cartID]
            );
            const totalAmount = totalResult?.TotalAmount || 0;

            await query(
                'UPDATE carts SET TotalAmount = ? WHERE CartID = ?',
                [totalAmount, cartID]
            );

            return res.json({ message: 'Item removed from cart.' });
        } else {
            const [product] = await query(
                'SELECT DiscountedPrice FROM products WHERE ProductID = ?',
                [productID]
            );

            if (!product) {
                return res.status(404).json({ error: 'Product not found.' });
            }

            const updatedSubtotal = product.DiscountedPrice * newQuantity;

            await query(
                `UPDATE cart_items 
                 SET Quantity = ?, Subtotal = ? 
                 WHERE CartID = ? AND ProductID = ?`,
                [newQuantity, updatedSubtotal, cartID, productID]
            );

            const [totalResult] = await query(
                'SELECT SUM(Subtotal) AS TotalAmount FROM cart_items WHERE CartID = ?',
                [cartID]
            );
            const totalAmount = totalResult?.TotalAmount || 0;

            await query(
                'UPDATE carts SET TotalAmount = ? WHERE CartID = ?',
                [totalAmount, cartID]
            );

            return res.json({ message: 'Cart item updated successfully.' });
        }
    } catch (error) {
        console.error('Error updating cart item:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.post('/api/checkout', async (req, res) => {
    const { customerNo, address, cardNumber, cardPassword, cvv } = req.body;

    if (!customerNo || !address || !cardNumber || !cardPassword || !cvv) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const [payment] = await query(
            'SELECT CardPassword, CVV FROM payments WHERE CardNo = ?',
            [cardNumber]
        );

        if (!payment) {
            return res.status(404).json({ error: 'Card not found.' });
        }

        if (payment.CardPassword !== cardPassword || payment.CVV !== parseInt(cvv)) {
            return res.status(403).json({ error: 'Invalid card credentials.' });
        }

        const [cart] = await query('SELECT CartID, TotalAmount FROM carts WHERE CustomerNo = ?', [customerNo]);
        if (!cart) {
            return res.status(404).json({ error: 'Cart not found for the given customer.' });
        }
        const { CartID, TotalAmount } = cart;
        const cartItems = await query('SELECT ProductID, Quantity, Subtotal FROM cart_items WHERE CartID = ?', [CartID]);
        const [maxOrder] = await query('SELECT MAX(OrderID) AS maxOrderID FROM orders');
        const newOrderID = (maxOrder?.maxOrderID || 0) + 1;

        await query(
            'INSERT INTO orders (OrderID, CustomerNo, TotalAmount, OrderDate, OrderStatus) VALUES (?, ?, ?, CURDATE(), ?)',
            [newOrderID, customerNo, TotalAmount, 'Ordered']
        );

        for (const item of cartItems) {
            await query(
                'INSERT INTO order_items (OrderID, ProductID, Quantity, Subtotal) VALUES (?, ?, ?, ?)',
                [newOrderID, item.ProductID, item.Quantity, item.Subtotal]
            );
        }

        const [maxDelivery] = await query('SELECT MAX(DeliveryID) AS maxDeliveryID FROM deliveries');
        const newDeliveryID = (maxDelivery?.maxDeliveryID || 0) + 1;

        await query(
            'INSERT INTO deliveries (DeliveryID, OrderID, CustomerNo, DeliveryStatus, Destination, CurrentLocation) VALUES (?, ?, ?, ?, ?, ?)',
            [newDeliveryID, newOrderID, customerNo, 'Confirming Order', address,'2500 Broadway W, Lubbock, TX 79409']
        );

        await query('DELETE FROM cart_items WHERE CartID = ?', [CartID]);
        await query('UPDATE carts SET TotalAmount = 0 WHERE CartID = ?', [CartID]);
        res.json({ message: 'Checkout completed successfully!' });
    } catch (error) {
        console.error('Error during checkout:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.get('/api/getOrders', async (req, res) => {
    const { customerNo } = req.query;

    if (!customerNo) {
        return res.status(400).json({ error: 'CustomerNo is required.' });
    }

    try {
        const orders = await query(
            `SELECT 
                OrderID, 
                TotalAmount, 
                DATE_FORMAT(OrderDate, '%Y-%m-%d') AS OrderDate, 
                OrderStatus 
             FROM orders 
             WHERE CustomerNo = ? 
             ORDER BY OrderDate DESC`,
            [customerNo]
        );

        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.get('/api/getDeliveries', async (req, res) => {
    const { customerNo } = req.query;

    if (!customerNo) {
        return res.status(400).json({ error: 'CustomerNo is required.' });
    }

    try {
        const deliveries = await query(
            `SELECT 
                DeliveryID, 
                OrderID, 
                DeliveryStatus, 
                Destination, 
                CurrentLocation 
             FROM deliveries 
             WHERE CustomerNo = ? AND DeliveryStatus != 'Delivered Confirmed'`,
            [customerNo]
        );

        res.json(deliveries);
    } catch (error) {
        console.error('Error fetching deliveries:', error.message, error.stack);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.get('/api/getProduct/:productId', async (req, res) => {
    const { productId } = req.params;

    if (!productId) {
        return res.status(400).json({ error: 'Product ID is required.' });
    }

    try {
        const product = await query(
            `SELECT 
                ProductID, 
                ProductName, 
                Description, 
                ROUND(ActualPrice, 2) AS ActualPrice, 
                ROUND(DiscountedPrice, 2) AS DiscountedPrice
             FROM products 
             WHERE ProductID = ?`,
            [productId]
        );

        if (product.length === 0) {
            return res.status(404).json({ error: 'Product not found.' });
        }

        res.json(product[0]);
    } catch (error) {
        console.error('Error fetching product details:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.post('/api/addProduct', async (req, res) => {
    const { productName, description, actualPrice, discountedPrice } = req.body;

    if (!productName || !description || !actualPrice || !discountedPrice) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const [maxProduct] = await query('SELECT MAX(ProductID) AS maxProductID FROM products');
        const newProductID = (maxProduct?.maxProductID || 0) + 1; // Increment by 1

        await query(
            `INSERT INTO products (ProductID, ProductName, Description, ActualPrice, DiscountedPrice) 
             VALUES (?, ?, ?, ?, ?)`,
            [newProductID, productName, description, actualPrice, discountedPrice]
        );

        console.log(`Product added: ProductID=${newProductID}, ProductName=${productName}`);
        res.json({ message: 'Product added successfully!', productID: newProductID });
    } catch (error) {
        console.error('Error adding product:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.put('/api/updateProduct/:productId', async (req, res) => {
    const { productId } = req.params;
    const { productName, description, actualPrice, discountedPrice } = req.body;

    if (!productName || !description || !actualPrice || !discountedPrice) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const connection = await mysql.createConnection(db_info);
        await connection.beginTransaction();
        const updateResult = await connection.execute(
            `UPDATE products 
             SET ProductName = ?, Description = ?, ActualPrice = ?, DiscountedPrice = ?
             WHERE ProductID = ?`,
            [productName, description, actualPrice, discountedPrice, productId]
        );

        if (updateResult[0].affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Product not found.' });
        }

        const updateCartItems = await connection.execute(
            `UPDATE cart_items 
             SET Subtotal = Quantity * ?
             WHERE ProductID = ?`,
            [discountedPrice, productId]
        );

        await connection.execute(
            `UPDATE carts 
             SET TotalAmount = (
                 SELECT COALESCE(SUM(ci.Subtotal), 0)
                 FROM cart_items ci
                 WHERE ci.CartID = carts.CartID
             )
             WHERE EXISTS (
                 SELECT 1 FROM cart_items ci WHERE ci.CartID = carts.CartID AND ci.ProductID = ?
             )`,
            [productId]
        );

        await connection.commit();
        console.log(`Product updated and related cart totals updated: ProductID=${productId}`);
        res.json({ message: 'Product updated successfully, and cart totals recalculated.' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error updating product or cart:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.delete('/api/deleteProduct/:productId', async (req, res) => {
    const { productId } = req.params;
    let connection;

    try {
        connection = await mysql.createConnection(db_info);
        await connection.beginTransaction();
        const deleteCartItemsResult = await connection.execute(
            'DELETE FROM cart_items WHERE ProductID = ?',
            [productId]
        );
        console.log(`Deleted from cart_items: ${deleteCartItemsResult[0].affectedRows} rows`);

        await connection.execute(
            `UPDATE carts 
             SET TotalAmount = (
                 SELECT COALESCE(SUM(ci.Subtotal), 0)
                 FROM cart_items ci
                 WHERE ci.CartID = carts.CartID
             )
             WHERE EXISTS (
                 SELECT 1 FROM cart_items ci WHERE ci.CartID = carts.CartID
             )`
        );

        const deleteWishlistResult = await connection.execute(
            'DELETE FROM wishlists WHERE ProductID = ?',
            [productId]
        );
        console.log(`Deleted from wishlists: ${deleteWishlistResult[0].affectedRows} rows`);

        const deleteProductResult = await connection.execute(
            'DELETE FROM products WHERE ProductID = ?',
            [productId]
        );

        if (deleteProductResult[0].affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Product not found.' });
        }

        await connection.commit();
        console.log(`Deleted product and updated cart totals: ProductID=${productId}`);
        res.json({ message: 'Product and related data deleted successfully, and cart totals updated.' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error deleting product or updating cart:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    } finally {
        if (connection) await connection.end();
    }
});

app.get('/api/getAllOrders', async (req, res) => {
    try {
        const orders = await query(
            `SELECT 
                OrderID, 
                CustomerNo, 
                TotalAmount, 
                DATE_FORMAT(OrderDate, '%Y-%m-%d') AS OrderDate, 
                OrderStatus 
             FROM orders 
             ORDER BY OrderID DESC`
        );

        res.json(orders);
    } catch (error) {
        console.error('Error fetching all orders:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.get('/api/getOrder/:orderID', async (req, res) => {
    const { orderID } = req.params;

    if (!orderID) {
        return res.status(400).json({ error: 'Order ID is required.' });
    }

    try {
        const order = await query(
            `SELECT 
                OrderID, 
                OrderStatus 
             FROM orders 
             WHERE OrderID = ?`,
            [orderID]
        );

        if (order.length === 0) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        res.json(order[0]);
    } catch (error) {
        console.error('Error fetching order:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.put('/api/updateOrder/:orderID', async (req, res) => {
    const { orderID } = req.params;
    const { orderStatus } = req.body;

    if (!orderStatus) {
        return res.status(400).json({ error: 'Order status is required.' });
    }

    try {
        const result = await query(
            `UPDATE orders 
             SET OrderStatus = ? 
             WHERE OrderID = ?`,
            [orderStatus, orderID]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Order not found.' });
        }

        res.json({ message: 'Order updated successfully!' });
    } catch (error) {
        console.error('Error updating order:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.get('/api/getAllDeliveries', async (req, res) => {
    try {
        const deliveries = await query(
            `SELECT 
                DeliveryID, 
                OrderID, 
                CustomerNo, 
                DeliveryStatus, 
                Destination, 
                CurrentLocation 
             FROM deliveries 
             ORDER BY DeliveryID DESC`
        );

        res.json(deliveries);
    } catch (error) {
        console.error('Error fetching deliveries:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.get('/api/getDelivery/:deliveryID', async (req, res) => {
    const { deliveryID } = req.params;

    if (!deliveryID) {
        return res.status(400).json({ error: 'Delivery ID is required.' });
    }

    try {
        const delivery = await query(
            `SELECT 
                DeliveryID, 
                DeliveryStatus, 
                CurrentLocation 
             FROM deliveries 
             WHERE DeliveryID = ?`,
            [deliveryID]
        );

        if (delivery.length === 0) {
            return res.status(404).json({ error: 'Delivery not found.' });
        }

        res.json(delivery[0]);
    } catch (error) {
        console.error('Error fetching delivery:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.put('/api/updateDelivery/:deliveryID', async (req, res) => {
    const { deliveryID } = req.params;
    const { deliveryStatus, currentLocation } = req.body;

    if (!deliveryStatus || !currentLocation) {
        return res.status(400).json({ error: 'Delivery status and current location are required.' });
    }

    try {
        const result = await query(
            `UPDATE deliveries 
             SET DeliveryStatus = ?, CurrentLocation = ? 
             WHERE DeliveryID = ?`,
            [deliveryStatus, currentLocation, deliveryID]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Delivery not found.' });
        }

        res.json({ message: 'Delivery updated successfully!' });
    } catch (error) {
        console.error('Error updating delivery:', error.message);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

app.listen(3000, () => console.log(`Server running on http://localhost:${3000}`));