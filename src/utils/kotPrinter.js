const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer');

class KOTPrinter {
  constructor() {
    this.printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: 'usb',
      characterSet: CharacterSet.PC852_LATIN2,
      removeSpecialCharacters: false,
      lineCharacter: "-",
    });
  }

  async printKOT(orderData) {
    try {
      const { restaurantName, orderNumber, items, createdAt } = orderData;
      
      this.printer.alignCenter();
      this.printer.setTextSize(1, 1);
      this.printer.bold(true);
      this.printer.println(restaurantName || 'Restaurant');
      this.printer.bold(false);
      this.printer.drawLine();
      
      this.printer.alignLeft();
      this.printer.println(`Order #: ${orderNumber}`);
      this.printer.println(`Date: ${new Date(createdAt).toLocaleDateString()}`);
      this.printer.println(`Time: ${new Date(createdAt).toLocaleTimeString()}`);
      this.printer.drawLine();
      
      items.forEach(item => {
        this.printer.println(`${item.quantity}x ${item.name}`);
        if (item.addons && item.addons.length > 0) {
          item.addons.forEach(addon => {
            this.printer.println(`  + ${addon.name}`);
          });
        }
      });
      
      this.printer.drawLine();
      this.printer.cut();
      
      await this.printer.execute();
      return { success: true };
    } catch (error) {
      console.error('KOT Print Error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new KOTPrinter();