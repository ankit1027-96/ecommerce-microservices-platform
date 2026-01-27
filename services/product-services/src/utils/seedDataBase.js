require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Brand = require("../models/Brand");

const seedDatabase = async () => {
  try {
    console.log("🌱 Starting database seeding...");

    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Brand.deleteMany({});
    console.log("🗑️  Cleared existing data");

    // Create Brands
    const brands = await Brand.create([
      { name: "Apple", description: "Innovation at its finest" },
      { name: "Samsung", description: "Leading electronics manufacturer" },
      { name: "OnePlus", description: "Never Settle" },
      { name: "Nike", description: "Just Do It" },
      { name: "Adidas", description: "Impossible is Nothing" },
      { name: "Sony", description: "Quality electronics" },
    ]);
    console.log(`✅ Created ${brands.length} brands`);

    // Create Categories
    const electronics = await Category.create({
      name: "Electronics",
      description: "Electronic devices and gadgets",
      level: 0,
    });

    const smartphones = await Category.create({
      name: "Smartphones",
      description: "Mobile phones and accessories",
      parentCategory: electronics._id,
      level: 1,
    });

    const laptops = await Category.create({
      name: "Laptops",
      description: "Portable computers",
      parentCategory: electronics._id,
      level: 1,
    });

    const clothing = await Category.create({
      name: "Clothing",
      description: "Fashion and apparel",
      level: 0,
    });

    const mensClothing = await Category.create({
      name: "Men's Clothing",
      description: "Clothing for men",
      parentCategory: clothing._id,
      level: 1,
    });

    console.log("✅ Created categories");

    // Create Products
    const products = await Product.create([
      {
        name: "iPhone 15 Pro Max",
        description:
          "The most advanced iPhone ever with titanium design, A17 Pro chip, and professional camera system.",
        shortDescription: "Latest iPhone with advanced features",
        category: smartphones._id,
        brand: brands[0]._id, // Apple
        price: 134900,
        comparePrice: 159900,
        images: [
          {
            url: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500",
            isPrimary: true,
            altText: "iPhone 15 Pro Max",
          },
        ],
        inventory: {
          quantity: 50,
          lowStockThreshold: 10,
        },
        tags: ["smartphone", "apple", "iphone", "5g"],
        isFeatured: true,
        status: "active",
        isActive: true,
        specifications: [
          { name: "Storage", value: "256GB", group: "Memory" },
          { name: "RAM", value: "8GB", group: "Memory" },
          { name: "Screen Size", value: "6.7 inch", group: "Display" },
          { name: "Camera", value: "48MP Main", group: "Camera" },
        ],
      },
      {
        name: "Samsung Galaxy S24 Ultra",
        description:
          "Premium Android flagship with S Pen, incredible camera capabilities, and stunning display.",
        shortDescription: "Samsung flagship smartphone",
        category: smartphones._id,
        brand: brands[1]._id, // Samsung
        price: 124999,
        comparePrice: 134999,
        images: [
          {
            url: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=500",
            isPrimary: true,
            altText: "Samsung Galaxy S24 Ultra",
          },
        ],
        inventory: {
          quantity: 35,
          lowStockThreshold: 10,
        },
        tags: ["smartphone", "samsung", "galaxy", "android"],
        isFeatured: true,
        status: "active",
        isActive: true,
      },
      {
        name: "OnePlus 12",
        description:
          "Flagship killer with amazing performance, fast charging, and premium build quality.",
        shortDescription: "OnePlus flagship device",
        category: smartphones._id,
        brand: brands[2]._id, // OnePlus
        price: 64999,
        comparePrice: 69999,
        images: [
          {
            url: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=500",
            isPrimary: true,
            altText: "OnePlus 12",
          },
        ],
        inventory: {
          quantity: 60,
          lowStockThreshold: 15,
        },
        tags: ["smartphone", "oneplus", "android", "5g"],
        isFeatured: false,
        status: "active",
        isActive: true,
      },
      {
        name: 'MacBook Pro 16" M3',
        description:
          "Professional laptop with M3 chip, stunning Liquid Retina XDR display, and all-day battery life.",
        shortDescription: "Apple MacBook Pro with M3",
        category: laptops._id,
        brand: brands[0]._id, // Apple
        price: 249900,
        comparePrice: 269900,
        images: [
          {
            url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500",
            isPrimary: true,
            altText: "MacBook Pro",
          },
        ],
        inventory: {
          quantity: 25,
          lowStockThreshold: 5,
        },
        tags: ["laptop", "macbook", "apple", "m3"],
        isFeatured: true,
        status: "active",
        isActive: true,
      },
      {
        name: "Nike Air Max 270",
        description:
          "Comfortable running shoes with Max Air cushioning and breathable mesh upper.",
        shortDescription: "Nike running shoes",
        category: mensClothing._id,
        brand: brands[3]._id, // Nike
        price: 12995,
        comparePrice: 14995,
        images: [
          {
            url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500",
            isPrimary: true,
            altText: "Nike Air Max",
          },
        ],
        inventory: {
          quantity: 100,
          lowStockThreshold: 20,
        },
        tags: ["shoes", "nike", "sports", "running"],
        isFeatured: false,
        status: "active",
        isActive: true,
        variants: [
          {
            name: "Size",
            value: "UK 8",
            inventory: { quantity: 25 },
            isActive: true,
          },
          {
            name: "Size",
            value: "UK 9",
            inventory: { quantity: 30 },
            isActive: true,
          },
          {
            name: "Size",
            value: "UK 10",
            inventory: { quantity: 25 },
            isActive: true,
          },
          {
            name: "Size",
            value: "UK 11",
            inventory: { quantity: 20 },
            isActive: true,
          },
        ],
      },
    ]);

    console.log(`✅ Created ${products.length} products`);

    // Update category product counts
    await Category.findByIdAndUpdate(smartphones._id, {
      "metadata.productCount": 3,
    });
    await Category.findByIdAndUpdate(laptops._id, {
      "metadata.productCount": 1,
    });
    await Category.findByIdAndUpdate(mensClothing._id, {
      "metadata.productCount": 1,
    });

    console.log("✅ Updated category metadata");
    console.log("\n🎉 Database seeded successfully!");
    console.log(`📦 Total Products: ${products.length}`);
    console.log(`🏷️  Total Brands: ${brands.length}`);
    console.log(`📂 Total Categories: 5`);
  } catch (error) {
    console.error("❌ Seeding error:", error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

seedDatabase();
