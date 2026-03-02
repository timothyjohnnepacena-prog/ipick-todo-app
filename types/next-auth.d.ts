import "next-auth";

declare module "next-auth" {
    interface Session {
        user: {
            name: string;
            email: string;
            id: string;
            image?: string;
        };
    }

    interface User {
        id: string;
        name: string;
        email: string;
        username: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string;
        username: string;
        email: string;
        name: string;
    }
}
