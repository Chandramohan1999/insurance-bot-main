import { v4 as uuidv4 } from "uuid";
import { Entity, EntityId, EntityStore } from "./types";
import { prisma } from "./prisma-client";
import { logger } from "./logger";

export class PrismaEntityStore implements EntityStore {
  private currentEntities: Map<string, Entity> = new Map();

  async getAll(type?: string): Promise<Entity[]> {
    try {
      if (!type) {
        // Get policies, members, and payments
        const policies = await prisma.policy.findMany();
        const members = await prisma.member.findMany();
        const payments = await prisma.payment.findMany();

        return [
          ...policies.map((p) => this.mapPolicyToEntity(p)),
          ...members.map((m) => this.mapMemberToEntity(m)),
          ...payments.map((p) => this.mapPaymentToEntity(p)),
        ];
      }

      switch (type) {
        case "policy":
          const policies = await prisma.policy.findMany();
          return policies.map((p) => this.mapPolicyToEntity(p));
        case "member":
          const members = await prisma.member.findMany();
          return members.map((m) => this.mapMemberToEntity(m));
        case "payment":
          const payments = await prisma.payment.findMany();
          return payments.map((p) => this.mapPaymentToEntity(p));
        default:
          return [];
      }
    } catch (error) {
      logger.error(`Error getting all entities of type ${type}:`, error);
      return [];
    }
  }

  async get(id: EntityId): Promise<Entity | null> {
    try {
      // Try to find in each model
      const policy = await prisma.policy.findUnique({ where: { id } });
      if (policy) return this.mapPolicyToEntity(policy);

      const member = await prisma.member.findUnique({ where: { id } });
      if (member) return this.mapMemberToEntity(member);

      const payment = await prisma.payment.findUnique({ where: { id } });
      if (payment) return this.mapPaymentToEntity(payment);

      return null;
    } catch (error) {
      logger.error(`Error getting entity with ID ${id}:`, error);
      return null;
    }
  }
  async add(entity: Entity): Promise<EntityId> {
    try {
      switch (entity.type) {
        case "policy":
          // Check if a policy with the same whatsapp number already exists
          if (!entity.data.whatsappNumber) {
            throw new Error("Policy must have a whatsappNumber");
          }

          // First, try to find an existing policy with the same phone number
          const existingPolicy = await prisma.policy.findFirst({
            where: { whatsappNumber: entity.data.whatsappNumber },
          });

          // If policy exists, update it instead of creating a new one
          if (existingPolicy) {
            const updatedPolicy = await prisma.policy.update({
              where: { id: existingPolicy.id },
              data: {
                ...entity.data,
                updatedAt: new Date(),
                isCompleted: false, // Reset completion status
              },
            });

            this.currentEntities.set(
              entity.type,
              this.mapPolicyToEntity(updatedPolicy)
            );
            logger.info(
              `Updated existing policy for ${entity.data.whatsappNumber}`
            );
            return updatedPolicy.id;
          }

          // If no existing policy, create a new one
          const policy = await prisma.policy.create({
            data: {
              id: entity.id || uuidv4(),
              whatsappNumber: entity.data.whatsappNumber,
              createdAt: entity.data.createdAt || new Date(),
              updatedAt: entity.data.updatedAt || new Date(),
              isCompleted: entity.data.isCompleted || false,
              ...entity.data,
            },
          });

          this.currentEntities.set(entity.type, this.mapPolicyToEntity(policy));
          return policy.id;

        case "member":
          if (!entity.data.policyId) {
            throw new Error("Member must be associated with a policy");
          }

          try {
            // Check if this member already exists
            if (entity.id) {
              const existingMember = await prisma.member.findUnique({
                where: { id: entity.id },
              });

              if (existingMember) {
                // If it exists, update it
                logger.debug(
                  `Member ${entity.id} already exists, updating instead of creating`
                );
                const updatedMember = await prisma.member.update({
                  where: { id: entity.id },
                  data: {
                    ...entity.data,
                  },
                });

                this.currentEntities.set(
                  entity.type,
                  this.mapMemberToEntity(updatedMember)
                );
                return updatedMember.id;
              }
            }

            // Create new member
            const member = await prisma.member.create({
              data: {
                id: entity.id || uuidv4(),
                firstName: entity.data.firstName || "",
                lastName: entity.data.lastName || "",
                dateOfBirth: entity.data.dateOfBirth || "",
                gender: entity.data.gender || "",
                policyId: entity.data.policyId,
                isPrimary: entity.data.isPrimary || false,
                addedAt: entity.data.addedAt || new Date(),
                ...entity.data,
              },
            });

            this.currentEntities.set(
              entity.type,
              this.mapMemberToEntity(member)
            );
            return member.id;
          } catch (error: any) {
            // If there's a unique constraint error, try again with a new ID
            if (error.code === "P2002") {
              logger.warn(
                `Unique constraint violation in entity store. Retrying with new ID...`
              );

              const newId = uuidv4();
              const member = await prisma.member.create({
                data: {
                  id: newId,
                  firstName: entity.data.firstName || "",
                  lastName: entity.data.lastName || "",
                  dateOfBirth: entity.data.dateOfBirth || "",
                  gender: entity.data.gender || "",
                  policyId: entity.data.policyId,
                  isPrimary: entity.data.isPrimary || false,
                  addedAt: entity.data.addedAt || new Date(),
                  ...entity.data,
                },
              });

              this.currentEntities.set(
                entity.type,
                this.mapMemberToEntity(member)
              );
              return member.id;
            } else {
              throw error;
            }
          }

        case "payment":
          if (!entity.data.policyId) {
            throw new Error("Payment must be associated with a policy");
          }

          const payment = await prisma.payment.create({
            data: {
              id: entity.id || uuidv4(),
              userId: entity.data.userId || "unknown",
              amount: entity.data.amount || 0,
              currency: entity.data.currency || "USD",
              status: entity.data.status || "PENDING",
              paymentMethod: entity.data.paymentMethod || "unknown",
              createdAt: entity.data.createdAt || new Date(),
              policyId: entity.data.policyId,
              ...entity.data,
            },
          });

          this.currentEntities.set(
            entity.type,
            this.mapPaymentToEntity(payment)
          );
          return payment.id;

        default:
          throw new Error(`Unsupported entity type: ${entity.type}`);
      }
    } catch (error) {
      logger.error(`Error adding entity of type ${entity.type}:`, error);
      throw error;
    }
  }

  async update(id: EntityId, data: Record<string, any>): Promise<boolean> {
    try {
      // First determine entity type
      const entity = await this.get(id);
      if (!entity) return false;

      switch (entity.type) {
        case "policy":
          await prisma.policy.update({
            where: { id },
            data,
          });
          break;

        case "member":
          await prisma.member.update({
            where: { id },
            data,
          });
          break;

        case "payment":
          await prisma.payment.update({
            where: { id },
            data,
          });
          break;

        default:
          return false;
      }

      // Update current entity if this is the current entity of its type
      const currentEntity = this.currentEntities.get(entity.type);
      if (currentEntity && currentEntity.id === id) {
        this.currentEntities.set(entity.type, {
          ...entity,
          data: { ...entity.data, ...data },
        });
      }

      return true;
    } catch (error) {
      logger.error(`Error updating entity with ID ${id}:`, error);
      return false;
    }
  }

  async delete(id: EntityId): Promise<boolean> {
    try {
      // First determine entity type
      const entity = await this.get(id);
      if (!entity) return false;

      switch (entity.type) {
        case "policy":
          await prisma.policy.delete({ where: { id } });
          break;

        case "member":
          await prisma.member.delete({ where: { id } });
          break;

        case "payment":
          await prisma.payment.delete({ where: { id } });
          break;

        default:
          return false;
      }

      // Remove from current entities if it's the current entity of its type
      const currentEntity = this.currentEntities.get(entity.type);
      if (currentEntity && currentEntity.id === id) {
        this.currentEntities.delete(entity.type);
      }

      return true;
    } catch (error) {
      logger.error(`Error deleting entity with ID ${id}:`, error);
      return false;
    }
  }

  async getCurrentEntity(type: string): Promise<Entity | null> {
    return this.currentEntities.get(type) || null;
  }

  async setCurrentEntity(type: string, entity: Entity): Promise<void> {
    this.currentEntities.set(type, entity);
  }

  // Helper methods to map database models to entities
  private mapPolicyToEntity(policy: any): Entity {
    const { id, ...policyData } = policy;
    return {
      id,
      type: "policy",
      data: policyData,
    };
  }

  private mapMemberToEntity(member: any): Entity {
    const { id, ...memberData } = member;
    return {
      id,
      type: "member",
      data: memberData,
    };
  }

  private mapPaymentToEntity(payment: any): Entity {
    const { id, ...paymentData } = payment;
    return {
      id,
      type: "payment",
      data: paymentData,
    };
  }
}

export function createEntity(
  type: string,
  data: Record<string, any> = {},
  id?: string
): Entity {
  return {
    id: id || uuidv4(),
    type,
    data,
  };
}

// Export singleton instance
export const entityStore = new PrismaEntityStore();
