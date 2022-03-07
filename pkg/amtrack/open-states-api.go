package amtrack

import "time"

type OpenStatesBill struct {
	ID                      string           `json:"id"`
	Session                 string           `json:"session"`
	Jurisdiction            Jurisdiction     `json:"jurisdiction"`
	FromOrganization        FromOrganization `json:"from_organization"`
	Identifier              string           `json:"identifier"`
	Title                   string           `json:"title"`
	Classification          []string         `json:"classification"`
	Subject                 interface{}      `json:"subject"`
	Extras                  interface{}      `json:"extras"`
	CreatedAt               time.Time        `json:"created_at"`
	UpdatedAt               time.Time        `json:"updated_at"`
	OpenstatesURL           string           `json:"openstates_url"`
	FirstActionDate         time.Time        `json:"first_action_date"`
	LatestActionDate        time.Time        `json:"latest_action_date"`
	LatestActionDescription string           `json:"latest_action_description"`
	LatestPassageDate       string           `json:"latest_passage_date"`
	Actions                 []Action         `json:"actions"`
}

type Jurisdiction struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Classification string `json:"classification"`
}

type FromOrganization struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Classification string `json:"classification"`
}

type Organization struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Classification string `json:"classification"`
}
type Action struct {
	Organization   Organization `json:"organization"`
	Description    string       `json:"description"`
	Date           time.Time    `json:"date"`
	Classification []string     `json:"classification"`
	Order          int          `json:"order"`
}
type CurrentRole struct {
	Title             string `json:"title"`
	OrgClassification string `json:"org_classification"`
	District          string `json:"district"`
	DivisionID        string `json:"division_id"`
}
type Voter struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Party       string      `json:"party"`
	CurrentRole CurrentRole `json:"current_role"`
}
type MemberVote struct {
	Option    string `json:"option"`
	VoterName string `json:"voter_name"`
	Voter     Voter  `json:"voter"`
}
type Counts struct {
	Option string `json:"option"`
	Value  int    `json:"value"`
}
type Sources struct {
	URL  string `json:"url"`
	Note string `json:"note"`
}
type Vote struct {
	ID                   string       `json:"id"`
	MotionText           string       `json:"motion_text"`
	MotionClassification interface{}  `json:"motion_classification"`
	StartDate            time.Time    `json:"start_date"`
	Result               string       `json:"result"`
	Identifier           string       `json:"identifier"`
	Extras               interface{}  `json:"extras"`
	Organization         Organization `json:"organization"`
	Votes                []MemberVote `json:"votes"`
	Counts               []Counts     `json:"counts"`
	Sources              []Sources    `json:"sources"`
}
