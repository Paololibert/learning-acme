import { sql } from "@vercel/postgres";
import {
  CustomersTableType,

} from "./definitions";
import { formatCurrency } from "./utils";
import prisma from "./prisma";

export async function fetchRevenue() {
  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    //console.log("Fetching revenue data...");
    //await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await prisma.revenue.findMany();

    console.log("Data fetch completed after 3 seconds.");

    return data;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch revenue data.");
  }
}
export async function fetchLatestInvoices() {
  try {
    const data = await prisma.invoice.findMany({
      orderBy: {
        date: "desc",
      },
      select: {
        id: true,
        amount: true,
        customer: {
          select: {
            name: true,
            email: true,
            imageUrl: true,
          },
        },
      },
      take: 5,
    });

    const latestInvoices = data.map((invoice) => ({
      id: invoice.id,
      amount: formatCurrency(invoice.amount), // formater le montant
      name: invoice.customer.name,
      email: invoice.customer.email,
      imageUrl: invoice.customer.imageUrl,
    }));

    //await new Promise((resolve) => setTimeout(resolve, 3000));

    return latestInvoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch the latest invoices.");
  }
}

export async function fetchCardData() {
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.

    /* 
        const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoices`;

        const customerCountPromise = sql`SELECT COUNT(*) FROM customers`;
        const invoiceStatusPromise = sql`SELECT
            SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
            SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
            FROM invoices`;

        const data = await Promise.all([
          invoiceCountPromise,
          customerCountPromise,
          invoiceStatusPromise,
        ]);

        const numberOfInvoices = Number(data[0].rows[0].count ?? "0");
        const numberOfCustomers = Number(data[1].rows[0].count ?? "0");
        const totalPaidInvoices = formatCurrency(data[2].rows[0].paid ?? "0");
        const totalPendingInvoices = formatCurrency(data[2].rows[0].pending ?? "0");

        return {
          numberOfCustomers,
          numberOfInvoices,
          totalPaidInvoices,
          totalPendingInvoices,
        }; 
    */
    // Execute queries in parallel for performance optimization
    const [
      totalInvoices,
      totalCustomers,
      totalPaidInvoices,
      totalPendingInvoices,
    ] = await Promise.all([
      prisma.invoice.count(), // Get total number of invoices
      prisma.customer.count(), // Get total number of customers
      prisma.invoice.aggregate({
        // Sum of all collected invoices (status: "paid")
        _sum: { amount: true },
        where: { status: "paid" }, // Only invoices that are marked as "paid"
      }),
      prisma.invoice.aggregate({
        // Sum of all pending invoices (status: "pending")
        _sum: { amount: true },
        where: { status: "pending" }, // Only invoices that are marked as "pending"
      }),
    ]);

    //await new Promise((resolve) => setTimeout(resolve, 3000));
    // Return the fetched data, ensuring amounts are formatted correctly
    return {
      totalPaidInvoices: totalPaidInvoices._sum.amount
        ? formatCurrency(totalPaidInvoices._sum.amount)
        : 0,
      numberOfInvoices: totalInvoices,
      numberOfCustomers: totalCustomers, // Format collected invoices amount or default to 0
      totalPendingInvoices: totalPendingInvoices._sum.amount
        ? formatCurrency(totalPendingInvoices._sum.amount)
        : 0, // Format pending invoices amount or default to 0
    };
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch card data.");
  }
}

const ITEMS_PER_PAGE = 6;
//const isDateQuery = !isNaN(Date.parse(query));
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    // Prisma query for filtering invoices based on customer info or invoice details
    let invoices = await prisma.invoice.findMany({
      where: {
        OR: [
          {
            customer: {
              name: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            customer: {
              email: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            amount: {
              equals: isNaN(Number(query)) ? undefined : Number(query),
            },
          },
          {
            status: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },
      include: {
        customer: {
          select: {
            name: true,
            email: true,
            imageUrl: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
      skip: offset,
      take: ITEMS_PER_PAGE,
    });

    // Check if the array is empty
    if (invoices.length === 0) {
      const parsedDate = new Date(query);

      // Check if parsedDate is a valid date
      if (!isNaN(parsedDate.getTime())) {
        invoices = await prisma.invoice.findMany({
          where: {
            OR: [
              {
                customer: {
                  name: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
              },
              {
                customer: {
                  email: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
              },
              {
                amount: {
                  equals: isNaN(Number(query)) ? undefined : Number(query),
                },
              },
              {
                date: {
                  equals: parsedDate, // Utiliser parsedDate ici
                },
              },
              {
                status: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            ],
          },
          include: {
            customer: {
              select: {
                name: true,
                email: true,
                imageUrl: true,
              },
            },
          },
          orderBy: {
            date: "desc",
          },
          skip: offset,
          take: ITEMS_PER_PAGE,
        });
      }
    }
   
    return invoices;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch invoices.");
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    let count: number;
    count = await prisma.invoice.count({
      where: {
        OR: [
          {
            customer: {
              name: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            customer: {
              email: {
                contains: query,
                mode: "insensitive",
              },
            },
          },
          {
            amount: {
              equals: isNaN(Number(query)) ? undefined : Number(query),
            },
          },
          {
            status: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },
    });
    if (count===0) {
      const parsedDate = new Date(query);

      // Check if parsedDate is a valid date
      if (!isNaN(parsedDate.getTime())) {
        count = await prisma.invoice.count({
          where: {
            OR: [
              {
                customer: {
                  name: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
              },
              {
                customer: {
                  email: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
              },
              {
                amount: {
                  equals: isNaN(Number(query)) ? undefined : Number(query),
                },
              },
              {
                date: {
                  equals: parsedDate, // Use parsedDate here
                },
              },
              {
                status: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            ],
          },
        });
      }
    }
    /* const count = await sql`SELECT COUNT(*) 
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE
      customers.name ILIKE ${`%${query}%`} OR
      customers.email ILIKE ${`%${query}%`} OR
      invoices.amount::text ILIKE ${`%${query}%`} OR
      invoices.date::text ILIKE ${`%${query}%`} OR
      invoices.status ILIKE ${`%${query}%`}
  `;

    const totalPages = Math.ceil(Number(count.rows[0].count) / ITEMS_PER_PAGE);
    return totalPages; */
    const totalPages = Math.ceil(count / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch total number of invoices.");
  }
}

export async function fetchInvoiceById(id: string) {
  
  try {
    const data = await prisma.invoice.findUnique({
      where: {
        id:id
      },
      select:{
        id:true,
        customerId:true,
        amount: true,
        status:true
      }
    })

    if (!data) {
      return null; 
    }
    
    /* const data = await sql<InvoiceForm>`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ${id};
    `;

    const invoice = data.rows.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    })); invoice[0]*/
    
    const invoice = {
      ...data,
      // Convert amount from cents to dollars
      amount: data.amount / 100,
    }
    console.log(invoice);
    return invoice;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    const data = await prisma.customer.findMany({
      orderBy:{
        name: 'asc'
      },
      select: {
        id: true,
        name:true,
      }

    })
    /* const data = await sql<CustomerField>`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `;

    const customers = data.rows; */
    return data;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch all customers.");
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    const customers = data.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error("Database Error:", err);
    throw new Error("Failed to fetch customer table.");
  }
}
