import { faker } from "@faker-js/faker";

export class TestDataGenerator {
  /**
   * Generates a unique, realistic customer registration payload
   */
  public static generateCustomer() {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    return {
      fullName: `${firstName} ${lastName}`,
      email: `test_${Date.now()}_${faker.string.alphanumeric(6).toLowerCase()}@aurazone-test.com`,
      password: "TestPassword@123",
      phone: `+91${faker.string.numeric(10)}`,
    };
  }

  /**
   * Generates a shipping/billing address payload
   */
  public static generateAddress() {
    return {
      name: `${faker.person.firstName()} ${faker.person.lastName()}`,
      phone: `98${faker.string.numeric(8)}`,
      addressLine1: "123 MG Road, Suite 400",
      addressLine2: "Near Metro Station",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400001",
      country: "India",
    };
  }

  /**
   * Generates a realistic product creation payload
   */
  public static generateProduct(storeId?: string) {
    const name = `Test ${faker.commerce.productAdjective()} ${faker.commerce.product()}_${faker.string.alphanumeric(4)}`;
    return {
      name,
      description: faker.commerce.productDescription(),
      storeId,
      variants: [
        {
          sku: `SKU-${Date.now()}-${faker.string.alphanumeric(4).toUpperCase()}`,
          price: parseFloat(faker.commerce.price({ min: 100, max: 2000 })),
          stockQuantity: faker.number.int({ min: 15, max: 100 }),
          attributes: { color: "Blue", size: "M" },
        },
      ],
    };
  }

  /**
   * Generates a valid test coupon payload
   */
  public static generateCoupon(opts?: { discountType?: "PERCENTAGE" | "FIXED_AMOUNT"; discountValue?: number }) {
    const type = opts?.discountType || "PERCENTAGE";
    const value = opts?.discountValue ?? (type === "PERCENTAGE" ? 15 : 200);
    const code = `TEST_${type === "PERCENTAGE" ? "PCT" : "FIX"}_${Date.now().toString(36).toUpperCase()}`;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    return {
      code,
      description: `Automation Generated Test Coupon ${code}`,
      discountType: type,
      discountValue: value,
      minOrderValue: 500,
      maxDiscount: type === "PERCENTAGE" ? 300 : null,
      usageLimit: 50,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      isActive: true,
    };
  }
}

