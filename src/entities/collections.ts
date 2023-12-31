import { Entity, BaseEntity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("collections")
export class Collections extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  coll_id: string;

  @Column({ type: "int", default: 0 })
  min_zoom: number;

  @Column({ type: "int", default: 22 })
  max_zoom: number;

  @Column({ type: "jsonb", nullable: true })
  properties: string;
}
