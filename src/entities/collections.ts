import { Entity, BaseEntity, PrimaryGeneratedColumn } from "typeorm";

@Entity("collections_test")
export class Collections extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  coll_id: string;
}
