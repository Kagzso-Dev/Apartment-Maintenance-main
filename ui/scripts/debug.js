// Test script to debug modal issue
console.log('=== Modal Debug Test ===');
console.log('Modal element:', document.getElementById('editModal'));
console.log('Modal body:', document.getElementById('modalBody'));
console.log('Admin status:', document.body.classList.contains('admin-mode'));
console.log('Edit buttons:', document.querySelectorAll('.btn-icon').length);

// Try to manually open modal
const testRecord = {
  flatNo: 'A101',
  ownerName: 'Test Owner',
  paymentStatus: 'Paid',
  paymentMode: 'UPI',
  paymentAmount: 2500,
  paymentDate: '15-01-2025',
  remarks: 'Test',
  monthlyAmount: 2500
};

if (typeof openEditModal !== 'undefined') {
  console.log('openEditModal function exists');
} else {
  console.error('openEditModal function NOT FOUND');
}
