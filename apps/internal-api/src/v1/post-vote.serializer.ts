import { Type } from "typebox"
import { UUID7String } from "../utils/common.serializer"

export const postVoteSchemaParam = Type.Object({
  postId: UUID7String,
})

export {
  downvoteSummarySchemaResponse as postVoteSummarySchemaResponse,
  downvoterListSchemaQuery as postDownvoterListSchemaQuery,
  voteSchemaRequest as postVoteSchemaRequest,
  voteSchemaResponse as postVoteSchemaResponse,
  voterListSchemaQuery as postVoterListSchemaQuery,
  voterListSchemaResponse as postVoterListSchemaResponse,
} from "./vote-shared.serializer"
