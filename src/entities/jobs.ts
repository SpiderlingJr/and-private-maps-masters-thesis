import {
  Entity,
  BaseEntity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";
import { Collections } from "./collections";

export enum JobState {
  PENDING = "pending",
  FINISHED = "finished",
  ERROR = "error",
}

@Entity("jobs_test")
export class Jobs extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  job_id: string;

  @Column({
    type: "enum",
    enum: JobState,
    default: JobState.PENDING,
  })
  job_state: JobState;

  @Column({ type: "varchar", length: 512, nullable: true })
  job_collection: Collections;

  @Column({ type: "varchar", length: 512, nullable: true })
  job_note: string;

  @CreateDateColumn()
  job_date: string;
}
