class UtilMethods {
    generateNumericSymbolString = (length: number = 256): string => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@$%^&*()_+-=[]{}|;:,.<>?';
      let result: string = '';
      for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        result += chars.charAt(randomIndex);
      }
      return result;
    }
}

export const utilMethods = new UtilMethods();