import {
  Entity,
  BaseEntity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";

import { Geometry } from "geojson";
import { Collections } from "src/entities/collections.js";

@Entity("features_test")
export class Features extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  feature_id: string;

  @ManyToOne((type) => Collections)
  @JoinColumn({ name: "ft_collection" })
  ft_collection: Collections;

  @Column({ type: "geometry" })
  geom: Geometry;

  @Column({ type: "jsonb", nullable: true })
  properties: string;
}
