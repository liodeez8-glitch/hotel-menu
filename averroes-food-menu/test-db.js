global.window = global;
const storage = new Map();
global.localStorage = {
  getItem(k) { return storage.has(k) ? storage.get(k) : null; },
  setItem(k, v) { storage.set(k, String(v)); },
  removeItem(k) { storage.delete(k); }
};

require('./assets/js/data.js');
require('./assets/js/db.js');

const DB = global.AverroesDB;

async function assert(name, condition) {
  if (condition) {
    console.log('PASS:', name);
  } else {
    throw new Error('FAIL: ' + name);
  }
}

async function run() {
  DB.resetToSeed();
  DB.logout();

  // 1. Manager login works
  await assert('manager_admin login with 12091209', await DB.login('manager_admin', '12091209'));
  await assert('manager role set', DB.getSession().role === 'manager');
  await assert('wrong manager password rejected', await DB.login('manager_admin', 'wrong') === false);

  // 2. Staff login works
  DB.logout();
  await assert('ave_admin login with 87654321', await DB.login('ave_admin', '87654321'));
  await assert('staff role set', DB.getSession().role === 'staff');

  // 3. Staff cannot delete manager
  const manager = DB.getUsers().find(u => u.username === 'manager_admin');
  await assert('staff cannot delete manager_admin', DB.deleteUser(manager.id) === false);

  // 4. Staff cannot create a manager
  const createdManager = await DB.addUser('fake_manager', 'pass', 'manager');
  await assert('staff cannot create manager', createdManager === null);

  // 5. Staff CAN create a normal staff admin
  const createdStaff = await DB.addUser('new_staff', 'newpass', 'staff');
  await assert('staff can create staff admin', createdStaff && createdStaff.role === 'staff');
  await assert('new staff admin can log in', await DB.login('new_staff', 'newpass') === true);

  // 6. Log in manager to test order ops
  DB.logout();
  await DB.login('manager_admin', '12091209');

  const order = DB.addOrder({
    customerId: 'cust-123',
    location: 'Table',
    identifier: '5',
    items: { 'meal-1': 2 }
  });
  await assert('order created PENDING', order.status === 'PENDING' && order.customerId === 'cust-123');

  // 6. Manager can confirm and complete
  let res = await DB.adminUpdateOrderStatus(order.id, 'CONFIRMED');
  await assert('manager can confirm order', res.success && res.order.status === 'CONFIRMED');
  res = await DB.adminUpdateOrderStatus(order.id, 'COMPLETED');
  await assert('manager can complete order', res.success && res.order.status === 'COMPLETED');

  // 7. Staff cannot cancel completed order (already completed)
  DB.logout();
  await DB.login('ave_admin', '87654321');
  res = await DB.adminUpdateOrderStatus(order.id, 'CANCELLED');
  await assert('staff cannot cancel completed order', res.error === 'staff cannot cancel');

  // 8. Manager delete order
  DB.logout();
  await DB.login('manager_admin', '12091209');
  res = DB.adminDeleteOrder(order.id);
  await assert('manager can delete order', res.success && !DB.getOrders().find(o => o.id === order.id));

  // 9. Staff cannot delete order
  const order3 = DB.addOrder({
    customerId: 'cust-999',
    location: 'Pool',
    identifier: 'P1',
    items: { 'meal-1': 1 }
  });
  DB.logout();
  await DB.login('ave_admin', '87654321');
  res = DB.adminDeleteOrder(order3.id);
  await assert('staff cannot delete order', res.error === 'manager only');

  // 12. Unread message counts
  DB.logout(); // customer chat no session needed
  const chat = DB.createChat('cust-123', null, 'Table', '5');
  DB.addMessage(chat.id, 'customer', 'Hello');
  DB.addMessage(chat.id, 'admin', 'Hi there');
  const adminUnread = DB.getTotalUnreadCountForAdmin();
  await assert('admin has 1 unread from customer', adminUnread === 1);
  const customerUnread = DB.getUnreadCountForCustomer('cust-123');
  await assert('customer has 1 unread from admin', customerUnread === 1);
  DB.markMessagesAsRead(chat.id, 'admin');
  await assert('admin marks customer message read', DB.getTotalUnreadCountForAdmin() === 0);
  DB.markMessagesAsRead(chat.id, 'customer');
  await assert('customer marks admin message read', DB.getUnreadCountForCustomer('cust-123') === 0);

  // 13. Staff can confirm an order
  DB.logout();
  await DB.login('ave_admin', '87654321');
  const staffOrder = DB.addOrder({ customerId: 'cust-staff', location: 'Table', identifier: '1', items: { 'meal-1': 1 } });
  res = await DB.adminUpdateOrderStatus(staffOrder.id, 'CONFIRMED');
  await assert('staff can confirm order', res.success && res.order.status === 'CONFIRMED');

  // 14. Manager can delete an order, staff cannot
  DB.logout();
  await DB.login('manager_admin', '12091209');
  res = DB.adminDeleteOrder(order3.id);
  await assert('manager can delete order', res.success && !DB.getOrders().find(o => o.id === order3.id));

  DB.logout();
  await DB.login('ave_admin', '87654321');
  res = DB.adminDeleteOrder(staffOrder.id);
  await assert('staff cannot delete order', res.error === 'manager only');

  // 15. Audit logs present for destructive actions
  const logs = DB.getAuditLogs();
  await assert('audit logs exist', logs.length > 0);
  await assert('audit contains ORDER_DELETED', logs.some(l => l.action === 'ORDER_DELETED'));

  console.log('\nAll tests passed.');
}

run().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});
